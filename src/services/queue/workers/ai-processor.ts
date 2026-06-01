import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getAIProvider } from "../../ai";
import { PostStatus } from "@prisma/client";

export const aiProcessorWorker = new Worker(
  QUEUES.AI_PROCESSOR,
  async (job: Job) => {
    const { collectedPostId, tone, workspaceId } = job.data;

    const collectedPost = await db.collectedPost.findUnique({
      where: { id: collectedPostId },
    });

    if (!collectedPost) return;

    const aiProvider = await getAIProvider();
    const aiResult = await aiProvider.generatePost(collectedPost.content, { tone });

    await db.generatedPost.create({
      data: {
        workspaceId,
        collectedPostId,
        originalContent: collectedPost.content,
        generatedContent: aiResult.content,
        tone: aiResult.tone,
        status: PostStatus.DRAFT,
      },
    });
  },
  workerOptions
);
