import { PlatformType } from "@prisma/client";

export interface SocialPost {
  externalId: string;
  content: string;
  authorName?: string;
  authorHandle?: string;
  mediaUrls?: string[];
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  postedAt: Date;
}

export interface SocialProvider {
  platform: PlatformType;
  
  // Auth & Connection
  getAuthUrl(state: string, callbackUrlOverride?: string): Promise<{ url: string; codeVerifier: string }>;
  exchangeCode(code: string, codeVerifier: string, redirectUriOverride?: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    platformId: string;
    handle?: string;
  }>;

  // Actions
  publishPost(accessToken: string, content: string, mediaUrls?: string[]): Promise<{ externalId: string }>;
  
  // Discovery
  fetchUserPosts(accessToken: string, handle: string, limit?: number): Promise<SocialPost[]>;
  searchHashtag(accessToken: string, hashtag: string, limit?: number): Promise<SocialPost[]>;
  searchKeyword(accessToken: string, keyword: string, limit?: number): Promise<SocialPost[]>;
  
  // Analytics
  getPostAnalytics(accessToken: string, externalId: string): Promise<Record<string, number | string | boolean | null>>;
}
