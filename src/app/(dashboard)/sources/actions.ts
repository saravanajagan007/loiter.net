"use server";

import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { contentFetcherQueue } from "@/services/queue/config";

export async function addSource(formData: FormData) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const type = formData.get("type") as SourceType;
  const value = formData.get("value") as string;

  const source = await db.contentSource.create({
    data: {
      workspaceId: session.user.workspaceId,
      type,
      value,
    },
  });

  // Trigger immediate fetch
  await contentFetcherQueue.add(`fetch-${source.id}`, { sourceId: source.id });

  revalidatePath("/sources");
}

export async function deleteSource(id: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

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

  await db.contentSource.update({
    where: {
      id,
      workspaceId: session.user.workspaceId,
    },
    data: { isActive },
  });

  revalidatePath("/sources");
}
