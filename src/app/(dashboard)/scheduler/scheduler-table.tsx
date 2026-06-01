"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, ExternalLink, Play, Trash2, Loader2 } from "lucide-react";
import { publishNow, cancelQueuedPost, markAsPosted } from "./actions";
import { toast } from "sonner";

interface QueuedPost {
  id: string;
  platform: string;
  scheduledFor: Date;
  status: string;
  generatedPost: {
    generatedContent: string;
  };
  publishedPost: {
    externalId: string;
  } | null;
}

interface SchedulerTableProps {
  queuedPosts: QueuedPost[];
  connectedHandle: string | null;
  page: number;
  totalPages: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function SchedulerTable({
  queuedPosts,
  connectedHandle,
  page,
  totalPages,
  sortBy,
  sortOrder
}: SchedulerTableProps) {
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const router = useRouter();

  const handleSort = (newSortBy: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("sortBy", newSortBy);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handleOrderToggle = () => {
    const params = new URLSearchParams(window.location.search);
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    params.set("sortOrder", newOrder);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const handleManualPost = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        toast.success(
          connectedHandle
            ? `Copied! Please verify you are logged into @${connectedHandle} on X.`
            : "Copied content to clipboard!"
        );
      })
      .catch((err) => {
        console.error("Could not copy: ", err);
        toast.error("Failed to copy to clipboard.");
      });
    
    const url = `https://x.com/intent/post?text=${encodeURIComponent(content)}`;
    window.open(url, "_blank");

    startTransition(async () => {
      try {
        await markAsPosted(id);
      } catch (err: any) {
        console.error("Failed to mark post as published:", err);
      }
    });
  };

  const handlePublishNow = (id: string) => {
    setActioningId(id);
    startTransition(async () => {
      try {
        const result = await publishNow(id);
        if (result.success) {
          toast.success("Publishing post now...");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to publish post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  const handleCancel = (id: string) => {
    setActioningId(id);
    startTransition(async () => {
      try {
        const result = await cancelQueuedPost(id);
        if (result.success) {
          toast.success("Post removed from queue and reset to Draft.");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to cancel scheduled post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border/50 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort By</span>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="flex h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium cursor-pointer"
          >
            <option value="scheduledFor">Scheduled Date</option>
            <option value="platform">Platform</option>
            <option value="status">Status</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOrderToggle}
            className="h-8 text-xs font-medium cursor-pointer flex items-center gap-1 hover:bg-muted/50 border border-input/30"
          >
            <span>{sortOrder === "asc" ? "⬆️ Ascending" : "⬇️ Descending"}</span>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Page {page} of {totalPages}
        </div>
      </div>

      <div className="border border-border/40 rounded-xl overflow-hidden shadow-xs bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Scheduled For</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Manual Post</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queuedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-28 bg-muted/10 rounded-b-xl border-dashed">
                  No posts in the scheduler. Approve some drafts in the AI Studio!
                </TableCell>
              </TableRow>
            ) : (
              queuedPosts.map((post) => {
                const isThisActioning = actioningId === post.id;
                const isPublished = post.status === "PUBLISHED";
                return (
                  <TableRow 
                    key={post.id} 
                    className={`transition-colors ${isPublished ? "opacity-60 bg-muted/20 select-none hover:bg-muted/25" : "hover:bg-muted/30"}`}
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-xs tracking-wider uppercase">{post.platform}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] sm:max-w-md truncate font-medium text-sm">
                      {post.generatedPost.generatedContent}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(post.scheduledFor).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(post.scheduledFor).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="text-xs font-semibold tracking-wider animate-pulse-slow"
                        variant={
                          post.status === "PUBLISHED" ? "default" :
                          post.status === "FAILED" ? "destructive" : "secondary"
                        }
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs font-semibold hover:bg-sky-500/10 hover:text-sky-500 cursor-pointer border border-muted-foreground/30 shadow-xs h-8 disabled:opacity-50 disabled:pointer-events-none"
                        onClick={() => handleManualPost(post.id, post.generatedPost.generatedContent)}
                        disabled={isPublished || isPending}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Post Manually
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {post.status === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Publish Now"
                              disabled={isPending}
                              onClick={() => handlePublishNow(post.id)}
                              className="hover:bg-primary/10 hover:text-primary cursor-pointer h-8 w-8"
                            >
                              {isThisActioning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancel Post"
                              disabled={isPending}
                              onClick={() => handleCancel(post.id)}
                              className="hover:bg-destructive/10 hover:text-destructive cursor-pointer h-8 w-8"
                            >
                              {isThisActioning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {post.status === "PUBLISHED" && post.publishedPost && (
                          <a
                            href={`https://twitter.com/i/status/${post.publishedPost.externalId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View Post"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-1 mt-2 gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="text-xs font-semibold cursor-pointer"
          >
            Previous
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(p)}
                className="h-8 w-8 text-xs font-bold cursor-pointer"
              >
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="text-xs font-semibold cursor-pointer"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
