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
  const { url, codeVerifier } = xProvider.getAuthUrl(state);

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
