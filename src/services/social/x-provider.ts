import { TwitterApi } from "twitter-api-v2";
import { PlatformType } from "@prisma/client";
import { SocialPost, SocialProvider } from "./types";
import { getSystemSetting } from "@/lib/settings";

export class XProvider implements SocialProvider {
  platform = PlatformType.X;

  constructor() {}

  async getAuthUrl(state: string): Promise<{ url: string; codeVerifier: string }> {
    const clientId = await getSystemSetting("X_CLIENT_ID");
    const clientSecret = await getSystemSetting("X_CLIENT_SECRET");
    const callbackUrl = await getSystemSetting("X_CALLBACK_URL");

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

  async exchangeCode(code: string, codeVerifier: string) {
    const clientId = await getSystemSetting("X_CLIENT_ID");
    const clientSecret = await getSystemSetting("X_CLIENT_SECRET");
    const callbackUrl = await getSystemSetting("X_CALLBACK_URL");

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

  async publishPost(accessToken: string, content: string): Promise<{ externalId: string }> {
    const client = new TwitterApi(accessToken);
    const { data: tweet } = await client.v2.tweet(content);
    return { externalId: tweet.id };
  }

  async fetchUserPosts(accessToken: string, handle: string, limit = 10): Promise<SocialPost[]> {
    const cleanHandle = handle.replace("@", "");
    const nitterUrlSetting = await getSystemSetting("NITTER_INSTANCE_URL");
    const nitterUrl = (nitterUrlSetting || "https://nitter.privacyredirect.com").replace(/\/$/, "");
    const url = `${nitterUrl}/${cleanHandle}/rss`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "TinyTinyRSS/21.0 (http://tt-rss.org/)",
          "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
        }
      });

      if (!res.ok) {
        throw new Error(`Nitter instance returned status ${res.status}`);
      }

      const rssText = await res.text();
      if (!rssText || !rssText.includes("<rss")) {
        throw new Error("Invalid RSS response from Nitter");
      }

      const posts: SocialPost[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;

      while ((match = itemRegex.exec(rssText)) !== null && count < limit) {
        const itemXml = match[1];

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

        const postedAt = pubDateStr ? new Date(pubDateStr) : new Date();

        posts.push({
          externalId,
          content,
          authorHandle: creator.replace("@", "") || cleanHandle,
          postedAt,
        });
        count++;
      }

      return posts;
    } catch (error: any) {
      console.error(`[XProvider] Error fetching timeline via Nitter: ${error.message}`);
      throw error;
    }
  }

  async searchHashtag(accessToken: string, hashtag: string, limit = 10): Promise<SocialPost[]> {
    const encodedHashtag = encodeURIComponent(hashtag);
    const nitterUrlSetting = await getSystemSetting("NITTER_INSTANCE_URL");
    const nitterUrl = (nitterUrlSetting || "https://nitter.privacyredirect.com").replace(/\/$/, "");
    const url = `${nitterUrl}/search/rss?q=${encodedHashtag}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "TinyTinyRSS/21.0 (http://tt-rss.org/)",
          "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
        }
      });

      if (!res.ok) {
        throw new Error(`Nitter instance returned status ${res.status}`);
      }

      const rssText = await res.text();
      if (!rssText || !rssText.includes("<rss")) {
        throw new Error("Invalid RSS response from Nitter");
      }

      const posts: SocialPost[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;

      while ((match = itemRegex.exec(rssText)) !== null && count < limit) {
        const itemXml = match[1];

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

        const postedAt = pubDateStr ? new Date(pubDateStr) : new Date();

        posts.push({
          externalId,
          content,
          authorHandle: creator.replace("@", ""),
          postedAt,
        });
        count++;
      }

      return posts;
    } catch (error: any) {
      console.error(`[XProvider] Error searching via Nitter: ${error.message}`);
      throw error;
    }
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
