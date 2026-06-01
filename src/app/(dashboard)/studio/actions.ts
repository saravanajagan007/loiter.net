"use server";

import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { postPublisherQueue } from "@/services/queue/config";
import { getAIProvider } from "@/services/ai";
import { PostStatus, PlatformType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function generateAIVersion(collectedPostId: string, tone: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const collectedPost = await db.collectedPost.findUnique({
    where: { id: collectedPostId },
  });

  if (!collectedPost) throw new Error("Post not found");

  const aiProvider = await getAIProvider();
  const aiResult = await aiProvider.generatePost(collectedPost.content, { tone });

  let generatedContent = aiResult.content || "";
  if (aiResult.hashtags && aiResult.hashtags.length > 0) {
    const missingTags = aiResult.hashtags
      .map(tag => tag.startsWith("#") ? tag : `#${tag}`)
      .filter(tag => !generatedContent.toLowerCase().includes(tag.toLowerCase()));
      
    if (missingTags.length > 0) {
      generatedContent = `${generatedContent}\n\n${missingTags.join(" ")}`;
    }
  }

  await db.generatedPost.create({
    data: {
      workspaceId: session.user.workspaceId,
      collectedPostId,
      originalContent: collectedPost.content,
      generatedContent,
      tone: aiResult.tone,
      status: PostStatus.DRAFT,
    },
  });

  revalidatePath("/studio");
  return { success: true };
}

export async function approvePost(generatedPostId: string, platform: PlatformType, scheduledFor: Date | string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const scheduledDate = new Date(scheduledFor);

  await db.$transaction(async (tx) => {
    // 1. Update generated post status
    await tx.generatedPost.update({
      where: { id: generatedPostId },
      data: { status: PostStatus.APPROVED },
    });

    // 2. Add to Queue
    const queuedPost = await tx.queuedPost.create({
      data: {
        workspaceId: session.user.workspaceId!,
        generatedPostId,
        platform,
        scheduledFor: scheduledDate,
      },
    });

    // 3. Queue in BullMQ with delay if future, or immediate if now/past
    const delay = Math.max(0, scheduledDate.getTime() - Date.now());
    await postPublisherQueue.add(
      `publish-${queuedPost.id}`,
      { queuedPostId: queuedPost.id },
      {
        delay,
        jobId: `publish-${queuedPost.id}`, // Set specific jobId so we can cancel it later
      }
    );
  });

  revalidatePath("/studio");
  revalidatePath("/scheduler");
}

export async function rejectPost(generatedPostId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await db.generatedPost.update({
    where: { id: generatedPostId },
    data: { status: PostStatus.REJECTED },
  });

  revalidatePath("/studio");
  return { success: true };
}

export async function updateDraftContent(generatedPostId: string, content: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await db.generatedPost.update({
    where: {
      id: generatedPostId,
      workspaceId: session.user.workspaceId,
    },
    data: {
      generatedContent: content,
    },
  });

  revalidatePath("/studio");
  return { success: true };
}

export async function deleteCollectedPost(collectedPostId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await db.collectedPost.delete({
    where: {
      id: collectedPostId,
      workspaceId: session.user.workspaceId,
    },
  });

  revalidatePath("/studio");
  return { success: true };
}

export async function deleteCollectedPosts(collectedPostIds: string[]) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await db.collectedPost.deleteMany({
    where: {
      id: { in: collectedPostIds },
      workspaceId: session.user.workspaceId,
    },
  });

  revalidatePath("/studio");
  return { success: true };
}

