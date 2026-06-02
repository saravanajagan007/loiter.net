"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, ExternalLink, Play, Trash2, Loader2 } from "lucide-react";
import { publishNow, cancelQueuedPost, markAsPosted } from "./actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface QueuedPost {
  id: string;
  platform: string;
  scheduledFor: Date;
  status: string;
  generatedPost: {
    generatedContent: string;
    collectedPost: {
      id: string;
      sourceType: string;
      authorHandle: string | null;
      content: string;
      postedAt: Date;
      mediaUrls: string[];
      externalId: string | null;
    } | null;
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

  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    isVideo: boolean;
    externalId?: string;
    authorHandle?: string;
  } | null>(null);

  const convertNitterUrlToTwitterCdn = (url: string): string => {
    if (!url) return url;
    const picIndex = url.indexOf("/pic/");
    if (picIndex !== -1) {
      const pathPart = url.substring(picIndex + 5);
      try {
        return `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
      } catch {
        return `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
      }
    }
    return url;
  };

  const renderMedia = (post: { mediaUrls: string[]; externalId: string | null; authorHandle: string | null; }) => {
    const urls = post.mediaUrls;
    if (!urls || urls.length === 0) return null;
    const hasVideo = urls.some(url => url.includes("video_thumb") || url.includes("ext_tw_video_thumb"));

    return (
      <div className="flex flex-wrap gap-1 mt-1.5 animate-in fade-in-50 duration-200">
        {urls.map((url, index) => {
          const cdnUrl = convertNitterUrlToTwitterCdn(url);
          return (
            <div 
              key={index} 
              className="relative w-12 h-12 rounded-md overflow-hidden border border-border/60 cursor-zoom-in hover:brightness-90 transition-all group"
              onClick={() => setPreviewMedia({
                url: cdnUrl,
                isVideo: hasVideo,
                externalId: post.externalId || undefined,
                authorHandle: post.authorHandle || undefined
              })}
            >
              <img src={cdnUrl} alt="media" referrerPolicy="no-referrer" className="object-cover w-full h-full" />
              {hasVideo && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/35 transition-colors">
                  <Play className="h-5 w-5 text-white drop-shadow-md fill-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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

  const handleManualPost = (id: string, content: string, mediaUrls?: string[]) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        if (mediaUrls && mediaUrls.length > 0) {
          toast.success("Text copied! We have opened the media attachments in new tabs. Right-click copy and paste them on X.");
        } else {
          toast.success(
            connectedHandle
              ? `Copied! Please verify you are logged into @${connectedHandle} on X.`
              : "Copied content to clipboard!"
          );
        }
      })
      .catch((err) => {
        console.error("Could not copy: ", err);
        toast.error("Failed to copy to clipboard.");
      });
    
    // Open Twitter compose page
    const composeUrl = `https://x.com/intent/post?text=${encodeURIComponent(content)}`;
    window.open(composeUrl, "_blank");

    // Open each media attachment URL in a new tab
    if (mediaUrls && mediaUrls.length > 0) {
      mediaUrls.forEach((url) => {
        const cdnUrl = convertNitterUrlToTwitterCdn(url);
        window.open(cdnUrl, "_blank");
      });
    }

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
                    className={isPublished ? "opacity-60 bg-muted/20 select-none hover:bg-muted/25" : ""}
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-xs tracking-wider uppercase">{post.platform}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-sm font-medium text-foreground">
                      <p className="whitespace-pre-wrap leading-relaxed">{post.generatedPost.generatedContent}</p>
                      {post.generatedPost.collectedPost && renderMedia(post.generatedPost.collectedPost)}
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
                        className={`text-xs font-semibold tracking-wider animate-pulse-slow ${
                          post.status === "VERIFYING"
                            ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 shadow-none"
                            : ""
                        }`}
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
                        onClick={() => handleManualPost(post.id, post.generatedPost.generatedContent, post.generatedPost.collectedPost?.mediaUrls)}
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

      {/* --- LIGHTBOX/VIDEO DIALOG --- */}
      <Dialog open={previewMedia !== null} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className={previewMedia?.isVideo ? "max-w-md p-0 overflow-hidden" : "max-w-3xl border-none bg-transparent p-0 overflow-hidden shadow-none flex items-center justify-center"}>
          {previewMedia && (
            previewMedia.isVideo ? (
              <div className="space-y-4 p-5 text-center bg-popover text-popover-foreground border rounded-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold">
                    <Play className="h-6 w-6 text-indigo-500 fill-indigo-500/20" />
                    <span>Watch Video Content</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border shadow-md bg-muted flex flex-col items-center justify-center p-6">
                  <img 
                    src={previewMedia.url} 
                    alt="Video thumbnail" 
                    referrerPolicy="no-referrer" 
                    className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xs" 
                  />
                  <div className="relative z-10 space-y-2 text-center max-w-sm">
                    <p className="text-sm font-semibold text-foreground">External Media Source</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Due to platform API and Nitter restrictions, the original video streaming file cannot be played directly inside the dashboard.
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex sm:justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewMedia(null)} className="h-9 cursor-pointer">
                    Close
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const tweetUrl = previewMedia.externalId 
                        ? `https://twitter.com/${previewMedia.authorHandle || "i"}/status/${previewMedia.externalId}`
                        : `https://twitter.com`;
                      window.open(tweetUrl, "_blank", "noopener,noreferrer");
                    }} 
                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Watch on X/Twitter
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <img src={previewMedia.url} alt="Preview" referrerPolicy="no-referrer" className="max-h-[85vh] object-contain rounded-lg shadow-2xl bg-black/5" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
