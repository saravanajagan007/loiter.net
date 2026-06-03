import redis from "@/lib/redis";

/**
 * Checks if a key can be used under the rate limits:
 * - Max 100 calls in the last 15 minutes (900 seconds)
 * - Max 500 calls in the last 24 hours (86400 seconds)
 * - Max 10000 calls in the last 30 days (2,592,000 seconds)
 * If yes, logs the current call in Redis and returns true. Otherwise, returns false.
 */
export async function acquireApiKey(apiKey: string): Promise<boolean> {
  const now = Date.now();
  const redisKey = `buffer:rate_limit:${apiKey}`;
  
  // 15 mins window = 15 * 60 * 1000 = 900,000 ms
  const fifteenMinsAgo = now - 15 * 60 * 1000;
  // 24 hours window = 24 * 60 * 60 * 1000 = 86,400,000 ms
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  // 30 days window = 30 * 24 * 60 * 60 * 1000 = 2,592,000,000 ms
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  try {
    const pipeline = redis.pipeline();
    
    // Remove timestamps older than 30 days
    pipeline.zremrangebyscore(redisKey, 0, thirtyDaysAgo);
    
    // Count total calls in the last 30 days
    pipeline.zcard(redisKey);
    
    // Count calls in the last 24 hours
    pipeline.zcount(redisKey, twentyFourHoursAgo, "+inf");
    
    // Count calls in the last 15 minutes
    pipeline.zcount(redisKey, fifteenMinsAgo, "+inf");

    const results = await pipeline.exec();
    if (!results) return false;

    const card30d = results[1][1] as number;
    const count24h = results[2][1] as number;
    const count15m = results[3][1] as number;

    if (count15m >= 100) {
      console.warn(`[Buffer Rate Limiter] Key starting with ${apiKey.substring(0, 8)} hit 15-minute rate limit (${count15m}/100 calls)`);
      return false;
    }

    if (count24h >= 500) {
      console.warn(`[Buffer Rate Limiter] Key starting with ${apiKey.substring(0, 8)} hit 24-hour rate limit (${count24h}/500 calls)`);
      return false;
    }

    if (card30d >= 10000) {
      console.warn(`[Buffer Rate Limiter] Key starting with ${apiKey.substring(0, 8)} hit 30-day rate limit (${card30d}/10000 calls)`);
      return false;
    }

    // Key is available! Record the call.
    const addPipeline = redis.pipeline();
    addPipeline.zadd(redisKey, now, String(now));
    // Set TTL to 30 days (in seconds)
    addPipeline.expire(redisKey, 30 * 24 * 60 * 60);
    await addPipeline.exec();

    return true;
  } catch (err: any) {
    console.error(`[Buffer Rate Limiter] Error evaluating rate limit for key: ${err.message}`);
    // Fallback to true if Redis fails to avoid blocking the publishing queue
    return true;
  }
}

/**
 * Rotates the keys using a round-robin index in Redis and returns the first available key.
 */
export async function getRotatedBufferKey(bufferToken: string): Promise<string> {
  const keys = bufferToken.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) throw new Error("No Buffer API keys provided");
  if (keys.length === 1) {
    const allowed = await acquireApiKey(keys[0]);
    if (!allowed) {
      throw new Error("The Buffer API key has hit its rate limits (100 calls/15m or 500 calls/24h)");
    }
    return keys[0];
  }

  const rotationIndexKey = "buffer:rotation_index";
  let index = 0;
  try {
    const rawIndex = await redis.get(rotationIndexKey);
    index = rawIndex ? parseInt(rawIndex, 10) : 0;
  } catch (err) {
    console.warn("[Buffer Rotation] Failed to get rotation index from Redis, defaulting to 0");
  }

  for (let i = 0; i < keys.length; i++) {
    const checkIndex = (index + i) % keys.length;
    const currentKey = keys[checkIndex];
    
    const allowed = await acquireApiKey(currentKey);
    if (allowed) {
      try {
        await redis.set(rotationIndexKey, (checkIndex + 1) % keys.length);
      } catch (err) {
        console.warn("[Buffer Rotation] Failed to save rotation index in Redis");
      }
      return currentKey;
    }
  }

  throw new Error("All provided Buffer API keys have hit their rate limits (100 calls/15m or 500 calls/24h)");
}

async function fetchGraphQL(token: string, query: string, variables: any = {}) {
  const url = "https://api.buffer.com";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  const payload = await res.json();
  if (payload.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

async function resolveChannelId(token: string, targetProfile: string): Promise<string> {
  const orgQuery = `
    query GetOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `;

  const orgData = await fetchGraphQL(token, orgQuery);
  const orgs = orgData.account?.organizations || [];
  
  for (const org of orgs) {
    const channelsQuery = `
      query GetChannels($orgId: OrganizationId!) {
        channels(input: { organizationId: $orgId }) {
          id
          name
          displayName
          service
        }
      }
    `;

    const channelsData = await fetchGraphQL(token, channelsQuery, { orgId: org.id });
    const channels = channelsData.channels || [];
    const matched = channels.find(
      (c: any) =>
        c.id === targetProfile ||
        c.name.toLowerCase() === targetProfile.toLowerCase() ||
        c.displayName.toLowerCase() === targetProfile.toLowerCase()
    );

    if (matched) {
      console.log(`[BufferProvider] Resolved profile "${targetProfile}" to channel ID: ${matched.id} (${matched.service})`);
      return matched.id;
    }
  }

  // Fallback to targetProfile directly if no match is found (assuming it might be a raw channel ID already)
  console.warn(`[BufferProvider] Could not find matched channel for profile name "${targetProfile}". Defaulting to raw ID.`);
  return targetProfile;
}

export async function publishViaBuffer(
  accessToken: string,
  profileId: string,
  content: string,
  mediaUrls?: string[]
): Promise<string> {
  // Rotate and get the active Buffer API key
  const activeKey = await getRotatedBufferKey(accessToken);
  console.log(`[BufferProvider] Using rotated API key starting with: ${activeKey.substring(0, 8)}`);

  // Extract inline media URLs from content
  let cleanedContent = content;
  const extractedUrls: string[] = [];
  const mediaRegex = /(https?:\/\/pbs\.twimg\.com\/[^\s]+|https?:\/\/[^\s]+\/pic\/[^\s]+|https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|mp4)(?:\?[^\s]*)?)/gi;
  const matches = content.match(mediaRegex);
  
  if (matches) {
    for (const match of matches) {
      extractedUrls.push(match);
      cleanedContent = cleanedContent.split(match).join("");
    }
    cleanedContent = cleanedContent.replace(/\s+/g, " ").trim();
  }

  const allMediaUrls = Array.from(new Set([...(mediaUrls || []), ...extractedUrls]));

  // Dynamically resolve the Buffer channel ID
  const resolvedId = await resolveChannelId(activeKey, profileId);

  // Prepare assets payload
  const assets: any[] = [];
  if (allMediaUrls.length > 0) {
    let mediaUrl = allMediaUrls[0];
    const picIndex = mediaUrl.indexOf("/pic/");
    if (picIndex !== -1) {
      const pathPart = mediaUrl.substring(picIndex + 5);
      try {
        mediaUrl = `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
      } catch {
        mediaUrl = `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
      }
    }

    const isVideo = mediaUrl.toLowerCase().includes(".mp4") || mediaUrl.toLowerCase().includes("video");
    if (isVideo) {
      assets.push({
        video: {
          url: mediaUrl
        }
      });
    } else {
      assets.push({
        image: {
          url: mediaUrl
        }
      });
    }
  }

  const createPostMutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const input: any = {
    channelId: resolvedId,
    text: cleanedContent,
    schedulingType: "automatic",
    mode: "shareNow"
  };

  if (assets.length > 0) {
    input.assets = assets;
  }

  console.log(`[BufferProvider] Sending post to Buffer channel ${resolvedId} via GraphQL...`);
  const postData = await fetchGraphQL(activeKey, createPostMutation, { input });
  
  if (postData.createPost?.message) {
    throw new Error(`Buffer GraphQL Error: ${postData.createPost.message}`);
  }

  const postId = postData.createPost?.post?.id;
  if (!postId) {
    throw new Error(`Buffer GraphQL returned invalid response: ${JSON.stringify(postData)}`);
  }

  console.log(`[BufferProvider] Post created successfully on Buffer via GraphQL. ID: ${postId}`);
  return postId;
}
