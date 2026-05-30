"use server";

import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { aiProcessorQueue, postPublisherQueue } from "@/services/queue/config";
import { PostStatus, PlatformType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function generateAIVersion(collectedPostId: string, tone: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await aiProcessorQueue.add(`ai-${collectedPostId}`, {
    collectedPostId,
    tone,
    workspaceId: session.user.workspaceId,
  });

  revalidatePath("/studio");
  return { success: true };
}

export async function approvePost(generatedPostId: string, platform: PlatformType, scheduledFor: Date) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

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
        scheduledFor,
      },
    });

    // 3. Add to publisher queue if scheduled for now or earlier
    if (scheduledFor <= new Date()) {
      await postPublisherQueue.add(`publish-${queuedPost.id}`, {
        queuedPostId: queuedPost.id,
      });
    }
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
