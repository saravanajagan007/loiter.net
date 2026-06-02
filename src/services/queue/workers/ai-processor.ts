import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getAIProvider } from "../../ai";
import { generateProceduralFallback } from "@/services/ai/fallback";
import { PostStatus } from "@prisma/client";

export const aiProcessorWorker = new Worker(
  QUEUES.AI_PROCESSOR,
  async (job: Job) => {
    const { collectedPostId, tone, workspaceId } = job.data;

    const collectedPost = await db.collectedPost.findUnique({
      where: { id: collectedPostId },
    });

    if (!collectedPost) return;

    let generatedContent = "";
    let finalTone = tone;
    let aiSucceeded = false;

    try {
      const aiProvider = await getAIProvider();
      const aiResult = await aiProvider.generatePost(collectedPost.content, { tone });
      generatedContent = aiResult.content || "";
      finalTone = aiResult.tone || tone;
      
      if (aiResult.hashtags && aiResult.hashtags.length > 0) {
        const missingTags = aiResult.hashtags
          .map(tag => tag.startsWith("#") ? tag : `#${tag}`)
          .filter(tag => !generatedContent.toLowerCase().includes(tag.toLowerCase()));
          
        if (missingTags.length > 0) {
          generatedContent = `${generatedContent}\n\n${missingTags.join(" ")}`;
        }
      }
      aiSucceeded = true;
    } catch (err: any) {
      console.warn(`[AI Processor Worker] AI generation failed, falling back to procedural: ${err.message}`);
    }

    if (!aiSucceeded) {
      generatedContent = generateProceduralFallback(collectedPost.content, tone);
    }

    const urls = collectedPost.mediaUrls ? (collectedPost.mediaUrls as string[]) : [];
    if (urls.length > 0) {
      const cdnUrls = urls.map(url => {
        const picIndex = url.indexOf("/pic/");
        if (picIndex !== -1) {
          const pathPart = url.substring(picIndex + 5);
          try {
            return `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
          } catch {
            return `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
          }
        }
        return url;
      });
      generatedContent = `${generatedContent}\n\n${cdnUrls.join(" ")}`;
    }

    await db.generatedPost.create({
      data: {
        workspaceId,
        collectedPostId,
        originalContent: collectedPost.content,
        generatedContent,
        tone: finalTone,
        status: PostStatus.DRAFT,
      },
    });
  },
  workerOptions
);
