"use server";

import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { postPublisherQueue } from "@/services/queue/config";
import { revalidatePath } from "next/cache";
import { PostStatus } from "@prisma/client";

export async function publishNow(queuedPostId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const queuedPost = await db.queuedPost.findUnique({
    where: { id: queuedPostId, workspaceId: session.user.workspaceId },
  });

  if (!queuedPost) throw new Error("Post not found");

  // 1. Update DB scheduledFor to now
  await db.queuedPost.update({
    where: { id: queuedPostId },
    data: { scheduledFor: new Date() },
  });

  // 2. Remove existing delayed job from BullMQ if present
  const job = await postPublisherQueue.getJob(`publish-${queuedPostId}`);
  if (job) {
    await job.remove();
  }

  // 3. Add to queue immediately
  await postPublisherQueue.add(
    `publish-${queuedPostId}`,
    { queuedPostId },
    { jobId: `publish-${queuedPostId}` }
  );

  revalidatePath("/scheduler");
  return { success: true };
}

export async function cancelQueuedPost(queuedPostId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const queuedPost = await db.queuedPost.findUnique({
    where: { id: queuedPostId, workspaceId: session.user.workspaceId },
  });

  if (!queuedPost) throw new Error("Post not found");

  // 1. Remove from BullMQ if present
  const job = await postPublisherQueue.getJob(`publish-${queuedPostId}`);
  if (job) {
    await job.remove();
  }

  // 2. Reset generated post status to DRAFT
  await db.generatedPost.update({
    where: { id: queuedPost.generatedPostId },
    data: { status: PostStatus.DRAFT },
  });

  // 3. Delete queued post
  await db.queuedPost.delete({
    where: { id: queuedPostId },
  });

  revalidatePath("/scheduler");
  revalidatePath("/studio");
  return { success: true };
}

export async function markAsPosted(queuedPostId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const job = await postPublisherQueue.getJob(`publish-${queuedPostId}`);
  if (job) {
    await job.remove();
  }

  await db.queuedPost.update({
    where: { id: queuedPostId, workspaceId: session.user.workspaceId },
    data: { status: "PUBLISHED" },
  });

  revalidatePath("/scheduler");
  return { success: true };
}
