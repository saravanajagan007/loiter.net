import { TwitterApi } from "twitter-api-v2";
import { PlatformType } from "@prisma/client";
import { SocialPost, SocialProvider } from "./types";
import { getSystemSetting } from "@/lib/settings";

function isEnglishOrTamil(text: string): boolean {
  if (!text) return false;
  
  // 1. Check for Tamil script characters (Unicode block U+0B80 to U+0BFF)
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return true;
  }

  // 2. Clean text for English check
  const clean = text
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/#[^\s]+/g, "")
    .replace(/@[^\s]+/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toLowerCase()
    .trim();

  if (!clean) return false;

  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return false;

  // Set of common English words and stop words
  const englishWords = new Set([
    "the", "and", "of", "to", "a", "in", "is", "that", "it", "on", "for", "with", "as", "this", "are", "be", "at", "by", "an", "have", "from", "or", "we", "you", "your", "my", "it's", "he", "she", "they", "was", "will", "would", "can", "should", "not", "but", "about", "their", "more", "one", "all", "so", "up", "out", "has", "who", "i", "me", "do", "go", "get", "no", "yes", "than", "then", "them", "our", "us", "good", "great", "new", "time", "day", "people", "like", "just", "now", "know", "think", "make", "see", "want", "look", "use", "find", "give", "way", "well", "how", "why", "what", "where", "when", "which", "some", "any", "other", "work", "first", "last", "also", "into", "over", "after", "many", "most", "very", "back", "even", "only", "such", "own", "here", "there"
  ]);

  let englishMatchCount = 0;
  for (const word of words) {
    if (englishWords.has(word)) {
      englishMatchCount++;
    }
  }

  // For short phrases (e.g. < 4 words), if it has English letters, treat as English
  if (words.length < 4) {
    return englishMatchCount > 0 || /^[a-z\s]+$/.test(clean);
  }

  // For longer text, require at least one match to common English words
  return englishMatchCount > 0;
}

export class XProvider implements SocialProvider {
  platform = PlatformType.X;

  constructor() {}

  async getAuthUrl(state: string, callbackUrlOverride?: string): Promise<{ url: string; codeVerifier: string }> {
    const clientId = await getSystemSetting("X_CLIENT_ID");
    const clientSecret = await getSystemSetting("X_CLIENT_SECRET");
    const callbackUrl = callbackUrlOverride || await getSystemSetting("X_CALLBACK_URL");

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    return client.generateOAuth2AuthLink(
      callbackUrl || process.env.X_CALLBACK_URL!,
      {
        state,
        scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      }
    );
  }

  async exchangeCode(code: string, codeVerifier: string, redirectUriOverride?: string) {
    const clientId = await getSystemSetting("X_CLIENT_ID");
    const clientSecret = await getSystemSetting("X_CLIENT_SECRET");
    const callbackUrl = redirectUriOverride || await getSystemSetting("X_CALLBACK_URL");

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    const { accessToken, refreshToken, expiresIn, client: loggedClient } = 
      await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackUrl || process.env.X_CALLBACK_URL!,
      });

    const { data: user } = await loggedClient.v2.me();

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      platformId: user.id,
      handle: user.username,
    };
  }

  async publishPost(accessToken: string, content: string, mediaUrls?: string[]): Promise<{ externalId: string }> {
    const client = new TwitterApi(accessToken);

    let mediaIds: string[] = [];
    if (mediaUrls && mediaUrls.length > 0) {
      for (const mediaUrl of mediaUrls) {
        try {
          let targetUrl = mediaUrl;
          const picIndex = mediaUrl.indexOf("/pic/");
          if (picIndex !== -1) {
            const pathPart = mediaUrl.substring(picIndex + 5);
            try {
              targetUrl = `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
            } catch {
              targetUrl = `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
            }
          }

          console.log(`[XProvider] Downloading media from: ${targetUrl}`);
          const response = await fetch(targetUrl);
          if (!response.ok) {
            console.error(`Failed to fetch media: ${response.statusText}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          console.log(`[XProvider] Uploading media to Twitter/X...`);
          const mediaId = await client.v1.uploadMedia(buffer, { mimeType: response.headers.get("content-type") || "image/jpeg" });
          mediaIds.push(mediaId);
          console.log(`[XProvider] Media uploaded successfully. Media ID: ${mediaId}`);
        } catch (err: any) {
          console.error(`[XProvider] Error uploading media ${mediaUrl}:`, err.message);
        }
      }
    }

    const tweetParams: any = {};
    if (mediaIds.length > 0) {
      tweetParams.media = { media_ids: mediaIds };
    }

    const { data: tweet } = await client.v2.tweet(content, tweetParams);
    return { externalId: tweet.id };
  }

  async fetchUserPosts(accessToken: string, handle: string, limit = 10): Promise<SocialPost[]> {
    const cleanHandle = handle.replace("@", "");

    // 1. Try official X API first if accessToken is present
    if (accessToken) {
      try {
        console.log(`[XProvider] Fetching timeline for @${cleanHandle} using official X API...`);
        const client = new TwitterApi(accessToken);
        const userResult = await client.v2.userByUsername(cleanHandle);
        if (userResult.data) {
          const userId = userResult.data.id;
          const timeline = await client.v2.userTimeline(userId, {
            max_results: Math.min(limit || 10, 100),
            "tweet.fields": ["created_at", "text"],
            "media.fields": ["url", "preview_image_url"],
            expansions: ["attachments.media_keys"]
          });

          const posts: SocialPost[] = [];
          for (const tweet of timeline.data.data || []) {
            if (!isEnglishOrTamil(tweet.text)) {
              continue;
            }
            posts.push({
              externalId: tweet.id,
              content: tweet.text,
              authorHandle: cleanHandle,
              postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
              mediaUrls: []
            });
          }
          console.log(`[XProvider] Successfully fetched ${posts.length} posts for @${cleanHandle} via official API.`);
          return posts;
        }
      } catch (apiError: any) {
        console.warn(`[XProvider] Official X API fetch for @${cleanHandle} failed: ${apiError.message}. Falling back to Nitter...`);
      }
    }

    // 2. Fallback to Nitter RSS
    const nitterUrlSetting = await getSystemSetting("NITTER_INSTANCE_URL");
    const baseInstances = [
      nitterUrlSetting || "https://nitter.privacyredirect.com",
      "https://nitter.poast.org",
      "https://xcancel.com"
    ];
    
    for (const rawUrl of baseInstances) {
      const nitterUrl = rawUrl.replace(/\/$/, "");
      const url = `${nitterUrl}/${cleanHandle}/rss`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
          }
        });

        if (!res.ok) {
          console.warn(`[XProvider] Nitter instance ${nitterUrl} failed with status ${res.status}`);
          continue;
        }

        const rssText = await res.text();
        if (!rssText || !rssText.includes("<rss")) {
          console.warn(`[XProvider] Invalid RSS response from Nitter instance ${nitterUrl}`);
          continue;
        }

        const posts: SocialPost[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;

        while ((match = itemRegex.exec(rssText)) !== null && count < limit) {
          const itemXml = match[1];

          // Extract title and filter out replies and retweets
          const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
          const title = titleMatch ? titleMatch[1].trim() : "";
          if (title.toLowerCase().startsWith("r to @") || title.toLowerCase().startsWith("rt by @")) {
            continue;
          }

          const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
          const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
          const guidMatch = /<guid[^>]*>([\s\S]*?)<\/guid>/.exec(itemXml);
          const creatorMatch = /<dc:creator>([\s\S]*?)<\/dc:creator>/.exec(itemXml);
          const descriptionMatch = /<description>([\s\S]*?)<\/description>/.exec(itemXml);

          const link = linkMatch ? linkMatch[1].trim() : "";
          const guid = guidMatch ? guidMatch[1].trim() : "";
          const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : "";
          const creator = creatorMatch ? creatorMatch[1].trim() : "";
          let description = descriptionMatch ? descriptionMatch[1].trim() : "";

          // Verify creator matches the handle we are fetching to exclude third-party retweets
          const cleanCreator = creator.replace("@", "").toLowerCase();
          if (cleanCreator !== cleanHandle.toLowerCase()) {
            continue;
          }

          if (description.startsWith("<![CDATA[")) {
            description = description.substring(9, description.length - 3).trim();
          }

          const mediaUrls: string[] = [];
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
          let imgMatch;
          while ((imgMatch = imgRegex.exec(description)) !== null) {
            let src = imgMatch[1];
            if (src.startsWith("/pic/")) {
              try {
                src = `https://pbs.twimg.com/${decodeURIComponent(src.substring(5))}`;
              } catch {
                src = `https://pbs.twimg.com/${src.substring(5).replace(/%2F/g, "/")}`;
              }
            } else if (src.startsWith("/")) {
              src = `${nitterUrl}${src}`;
            }
            src = src.replace(/&amp;/g, "&");
            mediaUrls.push(src);
          }

          const idMatch = /status\/(\d+)/.exec(guid || link);
          const externalId = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);

          let content = description
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim();

          content = content
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          // Filter only English and Tamil content
          if (!isEnglishOrTamil(content)) {
            continue;
          }

          const postedAt = pubDateStr ? new Date(pubDateStr) : new Date();

          posts.push({
            externalId,
            content,
            authorHandle: creator.replace("@", "") || cleanHandle,
            postedAt,
            mediaUrls,
          });
          count++;
        }

        console.log(`[XProvider] Successfully fetched ${posts.length} posts from Nitter instance ${nitterUrl}`);
        return posts;
      } catch (error: any) {
        console.warn(`[XProvider] Error fetching timeline via Nitter instance ${nitterUrl}: ${error.message}`);
      }
    }

    throw new Error("Failed to fetch user posts via all methods (Official API and Nitter fallbacks)");
  }

  async searchHashtag(accessToken: string, hashtag: string, limit = 10): Promise<SocialPost[]> {
    const encodedHashtag = encodeURIComponent(hashtag);

    // 1. Try official X API first if accessToken is present
    if (accessToken) {
      try {
        console.log(`[XProvider] Searching hashtag "${hashtag}" using official X API...`);
        const client = new TwitterApi(accessToken);
        const searchResults = await client.v2.search(hashtag, {
          max_results: Math.min(limit || 10, 100),
          "tweet.fields": ["created_at", "text", "author_id"],
          expansions: ["author_id"]
        });
        const posts: SocialPost[] = [];
        const users = searchResults.includes?.users 
          ? new Map(searchResults.includes.users.map(u => [u.id, u.username])) 
          : new Map();
        
        for (const tweet of searchResults.data.data || []) {
          if (!isEnglishOrTamil(tweet.text)) {
            continue;
          }
          posts.push({
            externalId: tweet.id,
            content: tweet.text,
            authorHandle: tweet.author_id ? users.get(tweet.author_id) || tweet.author_id : "",
            postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
            mediaUrls: []
          });
        }
        console.log(`[XProvider] Successfully fetched ${posts.length} posts for search "${hashtag}" via official API.`);
        return posts;
      } catch (apiError: any) {
        console.warn(`[XProvider] Official X API search for "${hashtag}" failed: ${apiError.message}. Falling back to Nitter...`);
      }
    }

    // 2. Fallback to Nitter RSS search
    const nitterUrlSetting = await getSystemSetting("NITTER_INSTANCE_URL");
    const baseInstances = [
      nitterUrlSetting || "https://nitter.privacyredirect.com",
      "https://nitter.poast.org",
      "https://xcancel.com"
    ];

    for (const rawUrl of baseInstances) {
      const nitterUrl = rawUrl.replace(/\/$/, "");
      const url = `${nitterUrl}/search/rss?q=${encodedHashtag}`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
          }
        });

        if (!res.ok) {
          console.warn(`[XProvider] Nitter instance search failed on ${nitterUrl} with status ${res.status}`);
          continue;
        }

        const rssText = await res.text();
        if (!rssText || !rssText.includes("<rss")) {
          console.warn(`[XProvider] Invalid search RSS response from Nitter instance ${nitterUrl}`);
          continue;
        }

        const posts: SocialPost[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;

        while ((match = itemRegex.exec(rssText)) !== null && count < limit) {
          const itemXml = match[1];

          // Extract title and filter out replies and retweets
          const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
          const title = titleMatch ? titleMatch[1].trim() : "";
          if (title.toLowerCase().startsWith("r to @") || title.toLowerCase().startsWith("rt by @")) {
            continue;
          }

          const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
          const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
          const guidMatch = /<guid[^>]*>([\s\S]*?)<\/guid>/.exec(itemXml);
          const creatorMatch = /<dc:creator>([\s\S]*?)<\/dc:creator>/.exec(itemXml);
          const descriptionMatch = /<description>([\s\S]*?)<\/description>/.exec(itemXml);

          const link = linkMatch ? linkMatch[1].trim() : "";
          const guid = guidMatch ? guidMatch[1].trim() : "";
          const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : "";
          const creator = creatorMatch ? creatorMatch[1].trim() : "";
          let description = descriptionMatch ? descriptionMatch[1].trim() : "";

          if (description.startsWith("<![CDATA[")) {
            description = description.substring(9, description.length - 3).trim();
          }

          const mediaUrls: string[] = [];
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
          let imgMatch;
          while ((imgMatch = imgRegex.exec(description)) !== null) {
            let src = imgMatch[1];
            if (src.startsWith("/pic/")) {
              try {
                src = `https://pbs.twimg.com/${decodeURIComponent(src.substring(5))}`;
              } catch {
                src = `https://pbs.twimg.com/${src.substring(5).replace(/%2F/g, "/")}`;
              }
            } else if (src.startsWith("/")) {
              src = `${nitterUrl}${src}`;
            }
            src = src.replace(/&amp;/g, "&");
            mediaUrls.push(src);
          }

          const idMatch = /status\/(\d+)/.exec(guid || link);
          const externalId = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);

          let content = description
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim();

          content = content
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          // Filter only English and Tamil content
          if (!isEnglishOrTamil(content)) {
            continue;
          }

          const postedAt = pubDateStr ? new Date(pubDateStr) : new Date();

          posts.push({
            externalId,
            content,
            authorHandle: creator.replace("@", ""),
            postedAt,
            mediaUrls,
          });
          count++;
        }

        console.log(`[XProvider] Successfully fetched ${posts.length} posts from Nitter instance search ${nitterUrl}`);
        return posts;
      } catch (error: any) {
        console.warn(`[XProvider] Error searching via Nitter instance ${nitterUrl}: ${error.message}`);
      }
    }

    throw new Error("Failed to search posts via all methods (Official API and Nitter fallbacks)");
  }

  async searchKeyword(accessToken: string, keyword: string, limit = 10): Promise<SocialPost[]> {
    return this.searchHashtag(accessToken, keyword, limit);
  }

  async getPostAnalytics(accessToken: string, externalId: string): Promise<Record<string, number | string | boolean | null>> {
    const client = new TwitterApi(accessToken);
    const tweet = await client.v2.singleTweet(externalId, {
      "tweet.fields": ["public_metrics", "non_public_metrics"],
    });
    return (tweet.data.public_metrics as unknown as Record<string, number | string | boolean | null>) || {};
  }
}
