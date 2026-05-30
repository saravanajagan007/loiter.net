import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { OpenAIProvider } from "../../ai/openai-provider";
import { PostStatus } from "@prisma/client";

const aiProvider = new OpenAIProvider();

export const aiProcessorWorker = new Worker(
  QUEUES.AI_PROCESSOR,
  async (job: Job) => {
    const { collectedPostId, tone, workspaceId } = job.data;

    const collectedPost = await db.collectedPost.findUnique({
      where: { id: collectedPostId },
    });

    if (!collectedPost) return;

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
