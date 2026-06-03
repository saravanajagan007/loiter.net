import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getSocialProvider } from "../../social";
import { PlatformType, SourceType } from "@prisma/client";
import { SocialPost } from "../../social/types";

export const contentFetcherWorker = new Worker(
  QUEUES.CONTENT_FETCHER,
  async (job: Job) => {
    const { sourceId } = job.data;
    
    const source = await db.contentSource.findUnique({
      where: { id: sourceId },
      include: { workspace: { include: { socialAccounts: true } } },
    });

    if (!source || !source.isActive) return;

    console.log(`[ContentFetcher] Starting poll for source "${source.value}" (ID: ${source.id})...`);

    try {
      // For now, assume X platform
      const xAccount = source.workspace.socialAccounts.find(a => a.platform === PlatformType.X);
      const accessToken = xAccount?.accessToken || "";

      const provider = getSocialProvider(PlatformType.X);
      let posts: SocialPost[] = [];

      if (source.type === SourceType.HANDLE) {
        posts = await provider.fetchUserPosts(accessToken, source.value);
      } else if (source.type === SourceType.HASHTAG) {
        posts = await provider.searchHashtag(accessToken, source.value);
      }

      // Keep last fetched post for reference, so that next time can fetch posts after that.
      // If there is no last post reference, then use current day posts for reference.
      let lastFetchedPost = null;
      if (source.type === SourceType.HANDLE) {
        const cleanHandle = source.value.replace("@", "");
        lastFetchedPost = await db.collectedPost.findFirst({
          where: {
            workspaceId: source.workspaceId,
            authorHandle: cleanHandle,
          },
          orderBy: { postedAt: "desc" },
        });
      } else {
        lastFetchedPost = await db.collectedPost.findFirst({
          where: {
            workspaceId: source.workspaceId,
            content: {
              contains: source.value,
            },
          },
          orderBy: { postedAt: "desc" },
        });
      }

      let referenceTime: Date;
      if (lastFetchedPost) {
        referenceTime = lastFetchedPost.postedAt;
        console.log(`[ContentFetcher] Source "${source.value}": Last post reference found at ${referenceTime.toISOString()}`);
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        referenceTime = today;
        console.log(`[ContentFetcher] Source "${source.value}": No reference found. Using current day start ${referenceTime.toISOString()}`);
      }

      const newPosts = posts.filter(
        (post) => new Date(post.postedAt).getTime() > referenceTime.getTime()
      );

      console.log(`[ContentFetcher] Source "${source.value}": Found ${newPosts.length} new posts (out of ${posts.length} fetched).`);

      // Save collected posts
      for (const post of newPosts) {
        await db.collectedPost.upsert({
          where: {
            workspaceId_externalId_sourceType: {
              workspaceId: source.workspaceId,
              externalId: post.externalId,
              sourceType: PlatformType.X,
            },
          },
          create: {
            workspaceId: source.workspaceId,
            externalId: post.externalId,
            sourceType: PlatformType.X,
            content: post.content,
            authorHandle: post.authorHandle,
            postedAt: post.postedAt,
            engagement: post.engagement as any,
            mediaUrls: post.mediaUrls ? post.mediaUrls : undefined,
          },
          update: {
            engagement: post.engagement as any,
            mediaUrls: post.mediaUrls ? post.mediaUrls : undefined,
          },
        });
      }
      
      console.log(`[ContentFetcher] Successfully polled source "${source.value}".`);
    } catch (err: any) {
      console.error(`[ContentFetcher] Failed to poll source "${source.value}": ${err.message}`);
      throw err;
    } finally {
      // Always update lastPolledAt so the UI knows we attempted the poll on schedule
      await db.contentSource.update({
        where: { id: sourceId },
        data: { lastPolledAt: new Date() },
      });
    }
  },
  workerOptions
);
