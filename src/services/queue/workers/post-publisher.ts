import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getSocialProvider } from "../../social";
import { QueueStatus } from "@prisma/client";
import { getSystemSetting } from "@/lib/settings";
import { publishViaBuffer } from "../../social/buffer";

export const postPublisherWorker = new Worker(
  QUEUES.POST_PUBLISHER,
  async (job: Job) => {
    const { queuedPostId } = job.data;

    const queuedPost = await db.queuedPost.findUnique({
      where: { id: queuedPostId },
      include: {
        workspace: { include: { socialAccounts: true } },
        generatedPost: {
          include: {
            collectedPost: true,
          },
        },
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

      // Extract media URLs if available
      const mediaUrls = (queuedPost.generatedPost.collectedPost?.mediaUrls as string[]) || undefined;

      // Determine publishing provider setting (native or buffer)
      const publishingProvider = (await getSystemSetting("PUBLISHING_PROVIDER")) || "native";
      let externalId = "";

      if (publishingProvider === "buffer") {
        const bufferToken = await getSystemSetting("BUFFER_ACCESS_TOKEN");
        const bufferProfileId = await getSystemSetting("BUFFER_PROFILE_ID");
        
        if (!bufferToken || !bufferProfileId) {
          throw new Error("Buffer settings (Access Token or Profile ID) are missing");
        }

        externalId = await publishViaBuffer(
          bufferToken,
          bufferProfileId,
          queuedPost.generatedPost.generatedContent,
          mediaUrls
        );
      } else {
        // Native Twitter X API
        const response = await provider.publishPost(
          account.accessToken,
          queuedPost.generatedPost.generatedContent,
          mediaUrls
        );
        externalId = response.externalId;
      }

      await db.queuedPost.update({
        where: { id: queuedPostId },
        data: { status: "VERIFYING" as any },
      });
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
