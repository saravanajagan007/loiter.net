"use server";

import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { contentFetcherQueue } from "@/services/queue/config";

export async function updateSourceQueue(sourceId: string, isActive: boolean) {
  const source = await db.contentSource.findUnique({
    where: { id: sourceId },
    include: { workspace: true },
  });
  if (!source) return;

  const intervalMinutes = source.workspace.fetchInterval;
  const every = intervalMinutes * 60 * 1000;

  // Clean up any existing repeatable job first
  const repeatableJobs = await contentFetcherQueue.getRepeatableJobs();
  const existingJob = repeatableJobs.find(
    (job) => job.id === sourceId || job.name === `fetch-repeat-${sourceId}`
  );
  if (existingJob) {
    await contentFetcherQueue.removeRepeatableByKey(existingJob.key);
  }

  // If active, register the repeatable job
  if (isActive) {
    await contentFetcherQueue.add(
      `fetch-repeat-${sourceId}`,
      { sourceId },
      {
        repeat: { every },
        jobId: sourceId,
      }
    );
  }
}

export async function addSource(formData: FormData) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const type = formData.get("type") as SourceType;
  const rawValue = formData.get("value") as string;

  if (type === SourceType.HANDLE && rawValue.includes(",")) {
    const handles = rawValue
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith("@") ? h : `@${h}`));

    for (const val of handles) {
      // Check if this source already exists in this workspace to prevent duplicates
      const existing = await db.contentSource.findFirst({
        where: {
          workspaceId: session.user.workspaceId,
          type: SourceType.HANDLE,
          value: val,
        },
      });

      if (!existing) {
        const source = await db.contentSource.create({
          data: {
            workspaceId: session.user.workspaceId,
            type: SourceType.HANDLE,
            value: val,
          },
        });
        await updateSourceQueue(source.id, true);
        await contentFetcherQueue.add(`fetch-${source.id}`, { sourceId: source.id });
      }
    }
  } else {
    let normalizedValue = rawValue.trim();
    if (type === SourceType.HANDLE && !normalizedValue.startsWith("@")) {
      normalizedValue = `@${normalizedValue}`;
    }

    // Check if this source already exists in this workspace to prevent duplicates
    const existing = await db.contentSource.findFirst({
      where: {
        workspaceId: session.user.workspaceId,
        type,
        value: normalizedValue,
      },
    });

    if (!existing) {
      const source = await db.contentSource.create({
        data: {
          workspaceId: session.user.workspaceId,
          type,
          value: normalizedValue,
        },
      });
      await updateSourceQueue(source.id, true);
      await contentFetcherQueue.add(`fetch-${source.id}`, { sourceId: source.id });
    }
  }

  revalidatePath("/sources");
}

export async function deleteSource(id: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  // Remove repeatable job from the queue
  await updateSourceQueue(id, false);

  await db.contentSource.delete({
    where: {
      id,
      workspaceId: session.user.workspaceId,
    },
  });

  revalidatePath("/sources");
}

export async function toggleSource(id: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  // Update repeatable job status in the queue
  await updateSourceQueue(id, isActive);

  await db.contentSource.update({
    where: {
      id,
      workspaceId: session.user.workspaceId,
    },
    data: { isActive },
  });

  revalidatePath("/sources");
}

export async function triggerManualFetch(sourceId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const source = await db.contentSource.findUnique({
    where: { id: sourceId, workspaceId: session.user.workspaceId },
  });

  if (!source) throw new Error("Source not found");

  const jobId = `manual-fetch-${source.id}-${Date.now()}`;
  await contentFetcherQueue.add(jobId, { sourceId: source.id });
  return { success: true };
}
