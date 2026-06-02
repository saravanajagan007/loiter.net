import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { StudioClient } from "./studio-client";

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const collectedPosts = await db.collectedPost.findMany({
    where: { 
      workspaceId: session.user.workspaceId,
      generatedPosts: {
        none: {}
      }
    },
    orderBy: { postedAt: "desc" },
  });

  const generatedPosts = await db.generatedPost.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { collectedPost: true },
    orderBy: { createdAt: "desc" },
  });

  const formattedCollected = collectedPosts.map(p => ({
    id: p.id,
    sourceType: p.sourceType,
    authorHandle: p.authorHandle,
    content: p.content,
    postedAt: p.postedAt,
    mediaUrls: p.mediaUrls ? (p.mediaUrls as string[]) : [],
  }));

  const formattedGenerated = generatedPosts.map(g => ({
    id: g.id,
    tone: g.tone,
    status: g.status,
    generatedContent: g.generatedContent,
    originalContent: g.originalContent,
    collectedPost: g.collectedPost ? {
      id: g.collectedPost.id,
      sourceType: g.collectedPost.sourceType,
      authorHandle: g.collectedPost.authorHandle,
      content: g.collectedPost.content,
      postedAt: g.collectedPost.postedAt,
      mediaUrls: g.collectedPost.mediaUrls ? (g.collectedPost.mediaUrls as string[]) : [],
    } : null
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Content Studio</h1>
        <p className="text-muted-foreground">Review collected content and generate AI-powered social posts.</p>
      </div>

      <StudioClient
        collectedPosts={formattedCollected}
        generatedPosts={formattedGenerated}
      />
    </div>
  );
}
