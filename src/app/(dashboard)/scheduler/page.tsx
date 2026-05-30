import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, ExternalLink } from "lucide-react";

export default async function SchedulerPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const queuedPosts = await db.queuedPost.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { generatedPost: true, publishedPost: true },
    orderBy: { scheduledFor: "asc" },
  });

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queuedPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                    No posts in the scheduler. Approve some drafts in the AI Studio!
                  </TableCell>
                </TableRow>
              ) : (
                queuedPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Badge variant="outline">{post.platform}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate font-medium">
                      {post.generatedPost.generatedContent}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1 font-medium">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(post.scheduledFor).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock className="h-3 w-3" />
                          {new Date(post.scheduledFor).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        post.status === "PUBLISHED" ? "default" : 
                        post.status === "FAILED" ? "destructive" : "secondary"
                      }>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {post.publishedPost && (
                        <a 
                          href={`https://twitter.com/i/status/${post.publishedPost.externalId}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
