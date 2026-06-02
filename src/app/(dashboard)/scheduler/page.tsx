import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { PlatformType } from "@prisma/client";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SchedulerTable } from "./scheduler-table";

interface SearchParams {
  page?: string;
  sortBy?: string;
  sortOrder?: string;
}

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  const sortBy = params.sortBy || "scheduledFor";
  const sortOrder = (params.sortOrder || "desc") as "asc" | "desc";

  // Build the orderBy object dynamically
  let orderBy: any = { scheduledFor: "desc" };
  if (sortBy === "scheduledFor") {
    orderBy = { scheduledFor: sortOrder };
  } else if (sortBy === "platform") {
    orderBy = { platform: sortOrder };
  } else if (sortBy === "status") {
    orderBy = { status: sortOrder };
  }

  // Get total count for pagination
  const totalPosts = await db.queuedPost.count({
    where: { workspaceId: session.user.workspaceId },
  });

  const queuedPosts = await db.queuedPost.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: {
      generatedPost: {
        include: {
          collectedPost: true,
        },
      },
      publishedPost: true,
    },
    orderBy,
    skip,
    take: limit,
  });

  const formattedQueued = queuedPosts.map(qp => ({
    id: qp.id,
    platform: qp.platform,
    scheduledFor: qp.scheduledFor,
    status: qp.status,
    generatedPost: {
      generatedContent: qp.generatedPost.generatedContent,
      collectedPost: qp.generatedPost.collectedPost ? {
        id: qp.generatedPost.collectedPost.id,
        sourceType: qp.generatedPost.collectedPost.sourceType,
        authorHandle: qp.generatedPost.collectedPost.authorHandle,
        content: qp.generatedPost.collectedPost.content,
        postedAt: qp.generatedPost.collectedPost.postedAt,
        mediaUrls: qp.generatedPost.collectedPost.mediaUrls ? (qp.generatedPost.collectedPost.mediaUrls as string[]) : [],
        externalId: qp.generatedPost.collectedPost.externalId,
      } : null
    },
    publishedPost: qp.publishedPost ? {
      externalId: qp.publishedPost.externalId,
    } : null
  }));

  const totalPages = Math.ceil(totalPosts / limit) || 1;

  const socialAccounts = await db.socialAccount.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      platform: PlatformType.X,
    },
    select: { handle: true },
  });
  const connectedHandle = socialAccounts[0]?.handle || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Post Scheduler</h1>
        <p className="text-muted-foreground">View and manage your upcoming and published social media posts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Queue</CardTitle>
          <CardDescription>Posts waiting to be published or recently completed.</CardDescription>
        </CardHeader>
        <CardContent>
          <SchedulerTable 
            queuedPosts={formattedQueued} 
            connectedHandle={connectedHandle}
            page={page}
            totalPages={totalPages}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
