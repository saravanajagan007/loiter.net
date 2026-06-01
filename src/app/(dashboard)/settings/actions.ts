"use server";

import { auth } from "@/lib/auth";
import { XProvider } from "@/services/social/x-provider";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { cookies } from "next/headers";

export async function connectX() {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const xProvider = new XProvider();
  const state = Math.random().toString(36).substring(7);
  const { url, codeVerifier } = await xProvider.getAuthUrl(state);

  const cookieStore = await cookies();
  cookieStore.set("x_oauth_state", state, { secure: true, httpOnly: true, maxAge: 600 });
  cookieStore.set("x_oauth_code_verifier", codeVerifier, { secure: true, httpOnly: true, maxAge: 600 });

  redirect(url);
}

export async function disconnectAccount(accountId: string) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  await db.socialAccount.delete({
    where: {
      id: accountId,
      workspaceId: session.user.workspaceId,
    },
  });
}

import { updateSourceQueue } from "../sources/actions";
import { revalidatePath } from "next/cache";

export async function updateFetchInterval(formData: FormData) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const intervalInput = formData.get("fetchInterval") as string;
  const fetchInterval = parseInt(intervalInput, 10);

  if (isNaN(fetchInterval) || fetchInterval < 1) {
    throw new Error("Interval must be a valid number of at least 1 minute");
  }

  // 1. Update workspace setting in database
  await db.workspace.update({
    where: { id: session.user.workspaceId },
    data: { fetchInterval },
  });

  // 2. Query all active content sources in the workspace
  const activeSources = await db.contentSource.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      isActive: true,
    },
  });

  // 3. Reschedule active fetch jobs with the new interval
  for (const source of activeSources) {
    await updateSourceQueue(source.id, true);
  }

  revalidatePath("/settings");
  return { success: true };
}

import { updateSystemSetting, clearSettingsCache } from "@/lib/settings";

export async function updateSystemSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user.workspaceId) throw new Error("Unauthorized");

  const aiProvider = formData.get("AI_PROVIDER") as string;
  const openaiApiKey = formData.get("OPENAI_API_KEY") as string;
  const geminiApiKey = formData.get("GEMINI_API_KEY") as string;
  const geminiModel = formData.get("GEMINI_MODEL") as string;
  const xClientId = formData.get("X_CLIENT_ID") as string;
  const xClientSecret = formData.get("X_CLIENT_SECRET") as string;
  const xCallbackUrl = formData.get("X_CALLBACK_URL") as string;
  const nitterInstanceUrl = formData.get("NITTER_INSTANCE_URL") as string;

  if (aiProvider === "gemini" || aiProvider === "openai") {
    await updateSystemSetting("AI_PROVIDER", aiProvider);
  }

  const isMasked = (val: string) => !val || val.includes("••••");

  if (!isMasked(openaiApiKey)) {
    await updateSystemSetting("OPENAI_API_KEY", openaiApiKey);
  }
  if (!isMasked(geminiApiKey)) {
    await updateSystemSetting("GEMINI_API_KEY", geminiApiKey);
  }
  if (geminiModel !== null) {
    await updateSystemSetting("GEMINI_MODEL", geminiModel);
  }
  if (!isMasked(xClientId)) {
    await updateSystemSetting("X_CLIENT_ID", xClientId);
  }
  if (!isMasked(xClientSecret)) {
    await updateSystemSetting("X_CLIENT_SECRET", xClientSecret);
  }
  if (xCallbackUrl !== null) {
    await updateSystemSetting("X_CALLBACK_URL", xCallbackUrl);
  }
  if (nitterInstanceUrl !== null) {
    await updateSystemSetting("NITTER_INSTANCE_URL", nitterInstanceUrl);
  }

  clearSettingsCache();
  revalidatePath("/settings");
  return { success: true };
}
