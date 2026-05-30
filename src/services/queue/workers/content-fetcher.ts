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

    // For now, assume X platform and use the first connected account
    const xAccount = source.workspace.socialAccounts.find(a => a.platform === PlatformType.X);
    if (!xAccount) return;

    const provider = getSocialProvider(PlatformType.X);
    let posts: SocialPost[] = [];

    if (source.type === SourceType.HANDLE) {
      posts = await provider.fetchUserPosts(xAccount.accessToken, source.value);
    } else if (source.type === SourceType.HASHTAG) {
      posts = await provider.searchHashtag(xAccount.accessToken, source.value);
    }

    // Save collected posts
    for (const post of posts) {
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
        },
        update: {
          engagement: post.engagement as any,
        },
      });
    }

    await db.contentSource.update({
      where: { id: sourceId },
      data: { lastPolledAt: new Date() },
    });
  },
  workerOptions
);
