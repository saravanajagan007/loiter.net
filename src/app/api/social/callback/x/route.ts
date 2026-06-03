import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { XProvider } from "@/services/social/x-provider";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { PlatformType } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("x_oauth_state")?.value;
  const codeVerifier = cookieStore.get("x_oauth_code_verifier")?.value;

  if (!code || !state || state !== savedState || !codeVerifier) {
    return NextResponse.json({ error: "Invalid OAuth state or missing code" }, { status: 400 });
  }

  try {
    const xProvider = new XProvider();
    const redirectUri = new URL(req.nextUrl.pathname, req.nextUrl.origin).toString();
    console.log("[X Callback] Exchanging code using redirectUri:", redirectUri);
    const tokens = await xProvider.exchangeCode(code, codeVerifier, redirectUri);

    await db.socialAccount.upsert({
      where: {
        workspaceId_platform_platformId: {
          workspaceId: session.user.workspaceId,
          platform: PlatformType.X,
          platformId: tokens.platformId,
        },
      },
      create: {
        workspaceId: session.user.workspaceId,
        platform: PlatformType.X,
        platformId: tokens.platformId,
        handle: tokens.handle,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      update: {
        handle: tokens.handle,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });

    // Clean up cookies
    cookieStore.delete("x_oauth_state");
    cookieStore.delete("x_oauth_code_verifier");

    return NextResponse.redirect(new URL("/settings", req.url));
  } catch (error) {
    console.error("X OAuth error:", error);
    return NextResponse.json({ error: "Failed to exchange code" }, { status: 500 });
  }
}
