import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Layers, Calendar, BarChart3, X, CheckCircle2 } from "lucide-react";
import { PostStatus, QueueStatus } from "@prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const workspaceId = session.user.workspaceId;

  const [sourcesCount, draftsCount, scheduledCount, socialAccounts] = await Promise.all([
    db.contentSource.count({ where: { workspaceId, isActive: true } }),
    db.generatedPost.count({ where: { workspaceId, status: PostStatus.DRAFT } }),
    db.queuedPost.count({ where: { workspaceId, status: QueueStatus.PENDING } }),
    db.socialAccount.findMany({ where: { workspaceId } }),
  ]);

  const stats = [
    { title: "Sources", value: sourcesCount.toString(), icon: Layers, description: "Active content sources" },
    { title: "AI Drafts", value: draftsCount.toString(), icon: Megaphone, description: "Pending review" },
    { title: "Scheduled", value: scheduledCount.toString(), icon: Calendar, description: "Posts in queue" },
    { title: "Reach", value: "0", icon: BarChart3, description: "Total impressions (30d)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {session?.user.name || "there"}</h1>
        <p className="text-muted-foreground">Here is what is happening in your workspace today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed rounded-lg">
              Content collection is active. Review new posts in the AI Studio.
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {socialAccounts.length === 0 ? (
                <>
                  <div className="text-sm text-muted-foreground">No accounts connected yet.</div>
                  <div className="h-24 bg-muted/50 rounded-lg flex items-center justify-center text-xs">
                    Twitter/X connection available in Settings.
                  </div>
                </>
              ) : (
                socialAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-500/10 rounded-full">
                        <X className="h-4 w-4 text-sky-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">@{account.handle}</span>
                        <span className="text-xs text-muted-foreground capitalize">{account.platform.toLowerCase()}</span>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
