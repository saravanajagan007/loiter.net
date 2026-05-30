import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getSocialProvider } from "../../social";
import { QueueStatus } from "@prisma/client";

export const postPublisherWorker = new Worker(
  QUEUES.POST_PUBLISHER,
  async (job: Job) => {
    const { queuedPostId } = job.data;

    const queuedPost = await db.queuedPost.findUnique({
      where: { id: queuedPostId },
      include: {
        workspace: { include: { socialAccounts: true } },
        generatedPost: true,
      },
    });

    if (!queuedPost || queuedPost.status !== QueueStatus.PENDING) return;

    const account = queuedPost.workspace.socialAccounts.find(
      (a) => a.platform === queuedPost.platform
    );

    if (!account) {
      throw new Error(`No social account connected for platform ${queuedPost.platform}`);
    }

    const provider = getSocialProvider(queuedPost.platform);

    try {
      await db.queuedPost.update({
        where: { id: queuedPostId },
        data: { status: QueueStatus.PROCESSING },
      });

      const { externalId } = await provider.publishPost(
        account.accessToken,
        queuedPost.generatedPost.generatedContent
      );

      await db.$transaction([
        db.publishedPost.create({
          data: {
            workspaceId: queuedPost.workspaceId,
            queuedPostId: queuedPost.id,
            platform: queuedPost.platform,
            externalId,
          },
        }),
        db.queuedPost.update({
          where: { id: queuedPostId },
          data: { status: QueueStatus.PUBLISHED },
        }),
      ]);
    } catch (error: any) {
      await db.queuedPost.update({
        where: { id: queuedPostId },
        data: {
          status: QueueStatus.FAILED,
          attempts: { increment: 1 },
          errorMessage: error.message,
        },
      });
      throw error;
    }
  },
  workerOptions
);
