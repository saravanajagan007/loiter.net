import { TwitterApi } from "twitter-api-v2";
import { PlatformType } from "@prisma/client";
import { SocialPost, SocialProvider } from "./types";

export class XProvider implements SocialProvider {
  platform = PlatformType.X;
  private client: TwitterApi;

  constructor() {
    this.client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
    });
  }

  getAuthUrl(state: string): { url: string; codeVerifier: string } {
    return this.client.generateOAuth2AuthLink(
      process.env.X_CALLBACK_URL!,
      {
        state,
        scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      }
    );
  }

  async exchangeCode(code: string, codeVerifier: string) {
    const { accessToken, refreshToken, expiresIn, client: loggedClient } = 
      await this.client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: process.env.X_CALLBACK_URL!,
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
    const client = new TwitterApi(accessToken);
    const user = await client.v2.userByUsername(handle.replace("@", ""));
    const timeline = await client.v2.userTimeline(user.data.id, {
      max_results: limit,
      "tweet.fields": ["created_at", "public_metrics"],
    });

    return timeline.data.data.map((tweet) => ({
      externalId: tweet.id,
      content: tweet.text,
      authorHandle: handle,
      postedAt: new Date(tweet.created_at!),
      engagement: tweet.public_metrics ? {
        likes: tweet.public_metrics.like_count,
        retweets: tweet.public_metrics.retweet_count,
        replies: tweet.public_metrics.reply_count,
      } : undefined,
    }));
  }

  async searchHashtag(accessToken: string, hashtag: string, limit = 10): Promise<SocialPost[]> {
    const client = new TwitterApi(accessToken);
    const search = await client.v2.search(hashtag, {
      max_results: limit,
      "tweet.fields": ["created_at", "public_metrics"],
      "expansions": ["author_id"],
    });

    return search.data.data.map((tweet) => ({
      externalId: tweet.id,
      content: tweet.text,
      postedAt: new Date(tweet.created_at!),
      engagement: tweet.public_metrics ? {
        likes: tweet.public_metrics.like_count,
        retweets: tweet.public_metrics.retweet_count,
        replies: tweet.public_metrics.reply_count,
      } : undefined,
    }));
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
