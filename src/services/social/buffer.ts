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

export async function publishViaBuffer(
  accessToken: string,
  profileId: string,
  content: string,
  mediaUrls?: string[]
): Promise<string> {
  // Rotate and get the active Buffer API key
  const activeKey = await getRotatedBufferKey(accessToken);
  console.log(`[BufferProvider] Using rotated API key starting with: ${activeKey.substring(0, 8)}`);

  const url = "https://api.bufferapp.com/1/updates/create.json";

  const body: any = {
    text: content,
    profile_ids: [profileId],
    now: true,
    shorten: false,
  };

  if (mediaUrls && mediaUrls.length > 0) {
    let mediaUrl = mediaUrls[0];
    const picIndex = mediaUrl.indexOf("/pic/");
    if (picIndex !== -1) {
      const pathPart = mediaUrl.substring(picIndex + 5);
      try {
        mediaUrl = `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
      } catch {
        mediaUrl = `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
      }
    }
    body.media = {
      picture: mediaUrl,
      thumbnail: mediaUrl,
    };
  }

  console.log(`[BufferProvider] Sending post to Buffer profile ${profileId}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${activeKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Buffer API returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  if (data.updates && data.updates.length > 0) {
    console.log(`[BufferProvider] Post created successfully on Buffer. Update ID: ${data.updates[0].id}`);
    return data.updates[0].id;
  }
  
  console.log(`[BufferProvider] Post created successfully on Buffer. Response ID: ${data.id || "unknown"}`);
  return data.id || "buffer-update";
}
