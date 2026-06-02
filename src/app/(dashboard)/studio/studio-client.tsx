"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  Calendar,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Send,
  Play,
  ExternalLink
} from "lucide-react";
import {
  generateAIVersion,
  generateAIVersions,
  approvePost,
  approvePosts,
  rejectPost,
  rejectPosts,
  updateDraftContent,
  deleteCollectedPost,
  deleteCollectedPosts,
  deleteGeneratedPost,
  deleteGeneratedPosts
} from "./actions";
import { PlatformType } from "@prisma/client";
import { toast } from "sonner";

interface CollectedPost {
  id: string;
  sourceType: string;
  authorHandle: string | null;
  content: string;
  postedAt: Date;
  mediaUrls: string[];
  externalId: string | null;
}

interface GeneratedPost {
  id: string;
  tone: string | null;
  status: string;
  generatedContent: string;
  originalContent: string | null;
  collectedPost: {
    id: string;
    sourceType: string;
    authorHandle: string | null;
    content: string;
    postedAt: Date;
    mediaUrls: string[];
    externalId: string | null;
  } | null;
}

interface StudioClientProps {
  collectedPosts: CollectedPost[];
  generatedPosts: GeneratedPost[];
}

const TONES = [
  { value: "viral", label: "Viral", icon: "🚀" },
  { value: "professional", label: "Pro", icon: "💼" },
  { value: "humorous", label: "Funny", icon: "😂" },
  { value: "educational", label: "Learn", icon: "📚" },
];

export function StudioClient({ collectedPosts, generatedPosts }: StudioClientProps) {
  const [activeTab, setActiveTab] = useState("discovery");
  const [activeDraftSubTab, setActiveDraftSubTab] = useState("pending");
  const [isPending, startTransition] = useTransition();

  // Selection states
  const [selectedDiscoveryIds, setSelectedDiscoveryIds] = useState<string[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [selectedApprovedIds, setSelectedApprovedIds] = useState<string[]>([]);
  const [selectedRejectedIds, setSelectedRejectedIds] = useState<string[]>([]);

  // Pagination states (10 items per page)
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const itemsPerPage = 10;

  // Editing draft states
  const [editingDraft, setEditingDraft] = useState<GeneratedPost | null>(null);
  const [editedContent, setEditedContent] = useState("");

  // Scheduling states
  const [schedulingDraft, setSchedulingDraft] = useState<GeneratedPost | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");

  // Media preview lightbox state
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    isVideo: boolean;
    externalId?: string;
    authorHandle?: string;
  } | null>(null);

  // Active action IDs for loading spinners
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Separate drafts by status
  const pendingDrafts = generatedPosts.filter(g => g.status === "DRAFT");
  const approvedDrafts = generatedPosts.filter(g => g.status === "APPROVED");
  const rejectedDrafts = generatedPosts.filter(g => g.status === "REJECTED");

  // Pagination slicing helper
  const paginate = (items: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  const totalDiscoveryPages = Math.ceil(collectedPosts.length / itemsPerPage);
  const totalPendingPages = Math.ceil(pendingDrafts.length / itemsPerPage);
  const totalApprovedPages = Math.ceil(approvedDrafts.length / itemsPerPage);
  const totalRejectedPages = Math.ceil(rejectedDrafts.length / itemsPerPage);

  const discoveryStartIndex = (discoveryPage - 1) * itemsPerPage;
  const pendingStartIndex = (pendingPage - 1) * itemsPerPage;
  const approvedStartIndex = (approvedPage - 1) * itemsPerPage;
  const rejectedStartIndex = (rejectedPage - 1) * itemsPerPage;

  // --- ACTIONS ---

  // Discovery: Remix Single
  const handleSingleRemix = (postId: string, tone: string) => {
    setActioningId(`remix-${postId}`);
    startTransition(async () => {
      try {
        const res = await generateAIVersion(postId, tone);
        if (res && res.fallback) {
          toast.success("Post remixed (Procedural Fallback used)");
        } else {
          toast.success("AI draft generated successfully!");
        }
        setActiveTab("drafts");
        setActiveDraftSubTab("pending");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate AI version.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Discovery: Remix Bulk
  const handleBulkRemix = (tone: string) => {
    if (selectedDiscoveryIds.length === 0) return;
    setActioningId("bulk-remix");
    startTransition(async () => {
      try {
        const res = await generateAIVersions(selectedDiscoveryIds, tone);
        if (res && res.fallbackCount && res.fallbackCount > 0) {
          toast.success(`Bulk remix complete. ${res.successCount} generated via AI, ${res.fallbackCount} generated via Fallback.`);
        } else {
          toast.success(`AI drafts generated for ${selectedDiscoveryIds.length} posts!`);
        }
        setSelectedDiscoveryIds([]);
        setActiveTab("drafts");
        setActiveDraftSubTab("pending");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate AI versions.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Discovery: Delete Single (Hard Delete)
  const handleDeleteCollected = (postId: string) => {
    setActioningId(`delete-${postId}`);
    startTransition(async () => {
      try {
        await deleteCollectedPost(postId);
        toast.success("Post removed from Discovery.");
        setSelectedDiscoveryIds(prev => prev.filter(id => id !== postId));
        if (paginate(collectedPosts, discoveryPage).length === 1 && discoveryPage > 1) {
          setDiscoveryPage(discoveryPage - 1);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to remove post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Discovery: Delete Bulk (Hard Delete)
  const handleBulkDeleteCollected = () => {
    if (selectedDiscoveryIds.length === 0) return;
    setActioningId("bulk-delete-discovery");
    startTransition(async () => {
      try {
        await deleteCollectedPosts(selectedDiscoveryIds);
        toast.success("Selected posts removed from Discovery.");
        setSelectedDiscoveryIds([]);
        const newTotalPages = Math.ceil((collectedPosts.length - selectedDiscoveryIds.length) / itemsPerPage);
        if (discoveryPage > newTotalPages && newTotalPages > 0) {
          setDiscoveryPage(newTotalPages);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to remove selected posts.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Approve Single Post Now
  const handleApproveNow = (draftId: string) => {
    setActioningId(`approve-${draftId}`);
    startTransition(async () => {
      try {
        await approvePost(draftId, PlatformType.X, new Date());
        toast.success("Post approved and sent for immediate publishing!");
      } catch (err: any) {
        toast.error(err.message || "Failed to approve post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Approve & Schedule Dialog Save
  const handleScheduleSubmit = () => {
    if (!schedulingDraft) return;
    if (!scheduleTime) {
      toast.error("Please select a valid date and time.");
      return;
    }
    const scheduledDate = new Date(scheduleTime);
    if (scheduledDate.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    const draftId = schedulingDraft.id;
    setSchedulingDraft(null);
    setActioningId(`approve-${draftId}`);

    startTransition(async () => {
      try {
        await approvePost(draftId, PlatformType.X, scheduledDate);
        toast.success("Post approved and scheduled successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to schedule post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Approve Bulk (Post Now)
  const handleBulkApprove = () => {
    if (selectedPendingIds.length === 0) return;
    setActioningId("bulk-approve-pending");
    startTransition(async () => {
      try {
        await approvePosts(selectedPendingIds, PlatformType.X, new Date());
        toast.success(`Approved and queued ${selectedPendingIds.length} posts!`);
        setSelectedPendingIds([]);
      } catch (err: any) {
        toast.error(err.message || "Failed to bulk approve posts.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Reject Single
  const handleRejectSingle = (draftId: string) => {
    setActioningId(`reject-${draftId}`);
    startTransition(async () => {
      try {
        await rejectPost(draftId);
        toast.success("Draft rejected.");
      } catch (err: any) {
        toast.error(err.message || "Failed to reject draft.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Reject Bulk
  const handleBulkReject = () => {
    if (selectedPendingIds.length === 0) return;
    setActioningId("bulk-reject-pending");
    startTransition(async () => {
      try {
        await rejectPosts(selectedPendingIds);
        toast.success(`Rejected ${selectedPendingIds.length} drafts.`);
        setSelectedPendingIds([]);
      } catch (err: any) {
        toast.error(err.message || "Failed to bulk reject drafts.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts: Edit Save
  const handleEditSave = () => {
    if (!editingDraft) return;
    const draftId = editingDraft.id;
    setEditingDraft(null);
    setActioningId(`edit-${draftId}`);
    startTransition(async () => {
      try {
        await updateDraftContent(draftId, editedContent);
        toast.success("Draft content updated!");
      } catch (err: any) {
        toast.error(err.message || "Failed to update draft.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts/Approved/Rejected: Hard Delete Single
  const handleDeleteDraft = (draftId: string, listType: string) => {
    setActioningId(`delete-draft-${draftId}`);
    startTransition(async () => {
      try {
        await deleteGeneratedPost(draftId);
        toast.success("Post permanently deleted.");
        setSelectedPendingIds(prev => prev.filter(id => id !== draftId));
        setSelectedApprovedIds(prev => prev.filter(id => id !== draftId));
        setSelectedRejectedIds(prev => prev.filter(id => id !== draftId));

        if (listType === "pending" && paginate(pendingDrafts, pendingPage).length === 1 && pendingPage > 1) {
          setPendingPage(pendingPage - 1);
        } else if (listType === "approved" && paginate(approvedDrafts, approvedPage).length === 1 && approvedPage > 1) {
          setApprovedPage(approvedPage - 1);
        } else if (listType === "rejected" && paginate(rejectedDrafts, rejectedPage).length === 1 && rejectedPage > 1) {
          setRejectedPage(rejectedPage - 1);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to delete post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // Drafts/Approved/Rejected: Hard Delete Bulk
  const handleBulkDeleteDrafts = (listType: string) => {
    let ids: string[] = [];
    if (listType === "pending") ids = selectedPendingIds;
    else if (listType === "approved") ids = selectedApprovedIds;
    else if (listType === "rejected") ids = selectedRejectedIds;

    if (ids.length === 0) return;
    setActioningId(`bulk-delete-drafts-${listType}`);
    startTransition(async () => {
      try {
        await deleteGeneratedPosts(ids);
        toast.success(`Deleted ${ids.length} posts.`);
        
        if (listType === "pending") {
          setSelectedPendingIds([]);
          const newPages = Math.ceil((pendingDrafts.length - ids.length) / itemsPerPage);
          if (pendingPage > newPages && newPages > 0) setPendingPage(newPages);
        } else if (listType === "approved") {
          setSelectedApprovedIds([]);
          const newPages = Math.ceil((approvedDrafts.length - ids.length) / itemsPerPage);
          if (approvedPage > newPages && newPages > 0) setApprovedPage(newPages);
        } else if (listType === "rejected") {
          setSelectedRejectedIds([]);
          const newPages = Math.ceil((rejectedDrafts.length - ids.length) / itemsPerPage);
          if (rejectedPage > newPages && newPages > 0) setRejectedPage(newPages);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to delete selected posts.");
      } finally {
        setActioningId(null);
      }
    });
  };

  // --- RENDER HELPERS ---
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
      <div className="flex flex-wrap gap-1 mt-1.5">
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="discovery" className="font-semibold">Discovery ({collectedPosts.length})</TabsTrigger>
          <TabsTrigger value="drafts" className="font-semibold">Drafts ({generatedPosts.length})</TabsTrigger>
        </TabsList>

        {/* --- DISCOVERY TAB --- */}
        <TabsContent value="discovery" className="space-y-4">
          <Card className="border border-border/80 shadow-xs">
            <CardContent className="pt-6 space-y-4">
              {/* Bulk Actions Header */}
              <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={
                        collectedPosts.length > 0 &&
                        selectedDiscoveryIds.length === paginate(collectedPosts, discoveryPage).length &&
                        paginate(collectedPosts, discoveryPage).every((p) => selectedDiscoveryIds.includes(p.id))
                      }
                      onChange={(e) => {
                        const pageItems = paginate(collectedPosts, discoveryPage);
                        if (e.target.checked) {
                          setSelectedDiscoveryIds(prev => [
                            ...prev.filter(id => !pageItems.some(item => item.id === id)),
                            ...pageItems.map(p => p.id)
                          ]);
                        } else {
                          setSelectedDiscoveryIds(prev => prev.filter(id => !pageItems.some(item => item.id === id)));
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    Select Page
                  </label>
                  {selectedDiscoveryIds.length > 0 && (
                    <Badge variant="secondary" className="font-bold text-foreground/80 bg-primary/10">
                      {selectedDiscoveryIds.length} Selected
                    </Badge>
                  )}
                </div>

                {selectedDiscoveryIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold cursor-pointer border-primary/20 text-primary hover:bg-primary hover:text-white">
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Remix Selected...
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {TONES.map(tone => (
                          <DropdownMenuItem key={tone.value} onClick={() => handleBulkRemix(tone.value)} className="cursor-pointer">
                            <span className="mr-2">{tone.icon}</span> {tone.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      onClick={handleBulkDeleteCollected}
                      disabled={actioningId !== null}
                    >
                      {actioningId === "bulk-delete-discovery" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete Selected
                    </Button>
                  </div>
                )}
              </div>

              {/* Discovery Table */}
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-44">Author</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead className="w-32">Collected</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectedPosts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground h-36 bg-muted/5 italic">
                          No new content collected yet. Run a manual poll or connect more sources to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginate(collectedPosts, discoveryPage).map((post) => {
                        const isSelected = selectedDiscoveryIds.includes(post.id);
                        const isRemixing = actioningId?.startsWith(`remix-${post.id}`);
                        const isDeleting = actioningId === `delete-${post.id}`;
                        return (
                          <TableRow key={post.id} className={isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDiscoveryIds(prev => [...prev, post.id]);
                                  } else {
                                    setSelectedDiscoveryIds(prev => prev.filter(id => id !== post.id));
                                  }
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-semibold text-[10px] tracking-wider uppercase">{post.sourceType}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground text-sm">
                              @{post.authorHandle || "Anonymous"}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-muted-foreground max-w-lg">
                              <p className="whitespace-pre-wrap leading-relaxed">&quot;{post.content}&quot;</p>
                              {renderMedia(post)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-semibold">
                              {new Date(post.postedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold cursor-pointer">
                                        {isRemixing ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                                        )}
                                        Remix
                                      </Button>
                                    }
                                  />
                                  <DropdownMenuContent align="end">
                                    {TONES.map(tone => (
                                      <DropdownMenuItem key={tone.value} onClick={() => handleSingleRemix(post.id, tone.value)} className="cursor-pointer">
                                        <span className="mr-2">{tone.icon}</span> {tone.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCollected(post.id)}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                  disabled={actioningId !== null}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Discovery Pagination */}
              {totalDiscoveryPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Showing {discoveryStartIndex + 1} to {Math.min(discoveryStartIndex + itemsPerPage, collectedPosts.length)} of {collectedPosts.length} posts
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDiscoveryPage((p) => Math.max(1, p - 1))}
                      disabled={discoveryPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-semibold px-2">
                      Page {discoveryPage} of {totalDiscoveryPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDiscoveryPage((p) => Math.min(totalDiscoveryPages, p + 1))}
                      disabled={discoveryPage === totalDiscoveryPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- DRAFTS TAB --- */}
        <TabsContent value="drafts" className="space-y-4">
          <Tabs value={activeDraftSubTab} onValueChange={setActiveDraftSubTab} className="w-full space-y-4">
            <TabsList className="grid w-full max-w-[450px] grid-cols-3">
              <TabsTrigger value="pending" className="text-xs font-semibold">Pending Drafts ({pendingDrafts.length})</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs font-semibold">Approved Posts ({approvedDrafts.length})</TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs font-semibold">Rejected Posts ({rejectedDrafts.length})</TabsTrigger>
            </TabsList>

            {/* --- PENDING DRAFTS SUBTAB --- */}
            <TabsContent value="pending" className="space-y-4">
              <Card className="border border-border/80 shadow-xs">
                <CardContent className="pt-6 space-y-4">
                  {/* Bulk Actions Header */}
                  <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={
                            pendingDrafts.length > 0 &&
                            selectedPendingIds.length === paginate(pendingDrafts, pendingPage).length &&
                            paginate(pendingDrafts, pendingPage).every((p) => selectedPendingIds.includes(p.id))
                          }
                          onChange={(e) => {
                            const pageItems = paginate(pendingDrafts, pendingPage);
                            if (e.target.checked) {
                              setSelectedPendingIds(prev => [
                                ...prev.filter(id => !pageItems.some(item => item.id === id)),
                                ...pageItems.map(p => p.id)
                              ]);
                            } else {
                              setSelectedPendingIds(prev => prev.filter(id => !pageItems.some(item => item.id === id)));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        Select Page
                      </label>
                      {selectedPendingIds.length > 0 && (
                        <Badge variant="secondary" className="font-bold text-foreground/80 bg-primary/10">
                          {selectedPendingIds.length} Selected
                        </Badge>
                      )}
                    </div>

                    {selectedPendingIds.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                          onClick={handleBulkApprove}
                          disabled={actioningId !== null}
                        >
                          {actioningId === "bulk-approve-pending" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve Selected
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white"
                          onClick={handleBulkReject}
                          disabled={actioningId !== null}
                        >
                          {actioningId === "bulk-reject-pending" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Reject Selected
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          onClick={() => handleBulkDeleteDrafts("pending")}
                          disabled={actioningId !== null}
                        >
                          {actioningId === "bulk-delete-drafts-pending" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete Selected
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Pending Table */}
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-24">Tone</TableHead>
                          <TableHead className="w-48">Original Post</TableHead>
                          <TableHead>AI Generated Draft</TableHead>
                          <TableHead className="w-32 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingDrafts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-36 bg-muted/5 italic">
                              No pending drafts. Generate them by remixing posts in the Discovery tab!
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginate(pendingDrafts, pendingPage).map((draft) => {
                            const isSelected = selectedPendingIds.includes(draft.id);
                            const isApproveLoading = actioningId === `approve-${draft.id}`;
                            const isRejectLoading = actioningId === `reject-${draft.id}`;
                            const isDeleteLoading = actioningId === `delete-draft-${draft.id}`;
                            return (
                              <TableRow key={draft.id} className={isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPendingIds(prev => [...prev, draft.id]);
                                      } else {
                                        setSelectedPendingIds(prev => prev.filter(id => id !== draft.id));
                                      }
                                    }}
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge className="capitalize font-semibold text-[10px] tracking-wider">
                                    <Sparkles className="mr-1 h-3 w-3 text-yellow-400" /> {draft.tone}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-xs">
                                  {draft.collectedPost ? (
                                    <div className="space-y-1">
                                      <p className="font-semibold text-foreground/80">@{draft.collectedPost.authorHandle || "Anonymous"}</p>
                                      <p className="whitespace-pre-wrap leading-relaxed italic">&quot;{draft.collectedPost.content}&quot;</p>
                                      {renderMedia(draft.collectedPost)}
                                    </div>
                                  ) : (
                                    <span className="italic text-muted-foreground/60">Manual input</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm font-medium text-foreground max-w-md">
                                  <p className="whitespace-pre-wrap leading-relaxed">{draft.generatedContent}</p>
                                  {draft.collectedPost && renderMedia(draft.collectedPost)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleApproveNow(draft.id)}
                                      disabled={actioningId !== null}
                                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                                      title="Publish/Queue now"
                                    >
                                      {isApproveLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Send className="h-4 w-4" />
                                      )}
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSchedulingDraft(draft);
                                        const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
                                        const localISO = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                        setScheduleTime(localISO);
                                      }}
                                      disabled={actioningId !== null}
                                      className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10 cursor-pointer"
                                      title="Approve & Schedule for later"
                                    >
                                      <Calendar className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingDraft(draft);
                                        setEditedContent(draft.generatedContent);
                                      }}
                                      disabled={actioningId !== null}
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                                      title="Edit Content"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRejectSingle(draft.id)}
                                      disabled={actioningId !== null}
                                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 cursor-pointer"
                                      title="Reject Draft"
                                    >
                                      {isRejectLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <XCircle className="h-4 w-4" />
                                      )}
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteDraft(draft.id, "pending")}
                                      disabled={actioningId !== null}
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                      title="Hard Delete from Database"
                                    >
                                      {isDeleteLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pending Pagination */}
                  {totalPendingPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground font-semibold">
                        Showing {pendingStartIndex + 1} to {Math.min(pendingStartIndex + itemsPerPage, pendingDrafts.length)} of {pendingDrafts.length} drafts
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                          disabled={pendingPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold px-2">
                          Page {pendingPage} of {totalPendingPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPendingPage((p) => Math.min(totalPendingPages, p + 1))}
                          disabled={pendingPage === totalPendingPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- APPROVED POSTS SUBTAB --- */}
            <TabsContent value="approved" className="space-y-4">
              <Card className="border border-border/80 shadow-xs">
                <CardContent className="pt-6 space-y-4">
                  {/* Bulk Actions Header */}
                  <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={
                            approvedDrafts.length > 0 &&
                            selectedApprovedIds.length === paginate(approvedDrafts, approvedPage).length &&
                            paginate(approvedDrafts, approvedPage).every((p) => selectedApprovedIds.includes(p.id))
                          }
                          onChange={(e) => {
                            const pageItems = paginate(approvedDrafts, approvedPage);
                            if (e.target.checked) {
                              setSelectedApprovedIds(prev => [
                                ...prev.filter(id => !pageItems.some(item => item.id === id)),
                                ...pageItems.map(p => p.id)
                              ]);
                            } else {
                              setSelectedApprovedIds(prev => prev.filter(id => !pageItems.some(item => item.id === id)));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        Select Page
                      </label>
                      {selectedApprovedIds.length > 0 && (
                        <Badge variant="secondary" className="font-bold text-foreground/80 bg-primary/10">
                          {selectedApprovedIds.length} Selected
                        </Badge>
                      )}
                    </div>

                    {selectedApprovedIds.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        onClick={() => handleBulkDeleteDrafts("approved")}
                        disabled={actioningId !== null}
                      >
                        {actioningId === "bulk-delete-drafts-approved" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete Selected (Cancel publishing)
                      </Button>
                    )}
                  </div>

                  {/* Approved Table */}
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-24">Tone</TableHead>
                          <TableHead>Approved Post Content</TableHead>
                          <TableHead className="w-48">Status Details</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedDrafts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-36 bg-muted/5 italic">
                              No approved posts. Review and approve drafts in the Pending tab!
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginate(approvedDrafts, approvedPage).map((draft) => {
                            const isSelected = selectedApprovedIds.includes(draft.id);
                            const isDeleteLoading = actioningId === `delete-draft-${draft.id}`;
                            return (
                              <TableRow key={draft.id} className={isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedApprovedIds(prev => [...prev, draft.id]);
                                      } else {
                                        setSelectedApprovedIds(prev => prev.filter(id => id !== draft.id));
                                      }
                                    }}
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge className="capitalize bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-none font-semibold text-[10px] tracking-wider">
                                    {draft.tone}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-semibold text-foreground max-w-md">
                                  <p className="whitespace-pre-wrap leading-relaxed">{draft.generatedContent}</p>
                                  {draft.collectedPost && renderMedia(draft.collectedPost)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> APPROVED
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">Queued in scheduler.</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteDraft(draft.id, "approved")}
                                    disabled={actioningId !== null}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                    title="Cancel publishing & delete"
                                  >
                                    {isDeleteLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Approved Pagination */}
                  {totalApprovedPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground font-semibold">
                        Showing {approvedStartIndex + 1} to {Math.min(approvedStartIndex + itemsPerPage, approvedDrafts.length)} of {approvedDrafts.length} approved
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setApprovedPage((p) => Math.max(1, p - 1))}
                          disabled={approvedPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold px-2">
                          Page {approvedPage} of {totalApprovedPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setApprovedPage((p) => Math.min(totalApprovedPages, p + 1))}
                          disabled={approvedPage === totalApprovedPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- REJECTED POSTS SUBTAB --- */}
            <TabsContent value="rejected" className="space-y-4">
              <Card className="border border-border/80 shadow-xs">
                <CardContent className="pt-6 space-y-4">
                  {/* Bulk Actions Header */}
                  <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={
                            rejectedDrafts.length > 0 &&
                            selectedRejectedIds.length === paginate(rejectedDrafts, rejectedPage).length &&
                            paginate(rejectedDrafts, rejectedPage).every((p) => selectedRejectedIds.includes(p.id))
                          }
                          onChange={(e) => {
                            const pageItems = paginate(rejectedDrafts, rejectedPage);
                            if (e.target.checked) {
                              setSelectedRejectedIds(prev => [
                                ...prev.filter(id => !pageItems.some(item => item.id === id)),
                                ...pageItems.map(p => p.id)
                              ]);
                            } else {
                              setSelectedRejectedIds(prev => prev.filter(id => !pageItems.some(item => item.id === id)));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        Select Page
                      </label>
                      {selectedRejectedIds.length > 0 && (
                        <Badge variant="secondary" className="font-bold text-foreground/80 bg-primary/10">
                          {selectedRejectedIds.length} Selected
                        </Badge>
                      )}
                    </div>

                    {selectedRejectedIds.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        onClick={() => handleBulkDeleteDrafts("rejected")}
                        disabled={actioningId !== null}
                      >
                        {actioningId === "bulk-delete-drafts-rejected" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete Selected
                      </Button>
                    )}
                  </div>

                  {/* Rejected Table */}
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-24">Tone</TableHead>
                          <TableHead>Dismissed Content</TableHead>
                          <TableHead className="w-48">Status Details</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rejectedDrafts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-36 bg-muted/5 italic">
                              No rejected drafts.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginate(rejectedDrafts, rejectedPage).map((draft) => {
                            const isSelected = selectedRejectedIds.includes(draft.id);
                            const isDeleteLoading = actioningId === `delete-draft-${draft.id}`;
                            return (
                              <TableRow key={draft.id} className={isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRejectedIds(prev => [...prev, draft.id]);
                                      } else {
                                        setSelectedRejectedIds(prev => prev.filter(id => id !== draft.id));
                                      }
                                    }}
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge className="capitalize bg-muted border border-border/50 text-muted-foreground shadow-none font-semibold text-[10px] tracking-wider">
                                    {draft.tone}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-md line-through decoration-muted-foreground/30">
                                  <p className="whitespace-pre-wrap leading-relaxed">{draft.generatedContent}</p>
                                  {draft.collectedPost && renderMedia(draft.collectedPost)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <span className="text-destructive font-bold flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> REJECTED
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteDraft(draft.id, "rejected")}
                                    disabled={actioningId !== null}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                    title="Delete from database"
                                  >
                                    {isDeleteLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Rejected Pagination */}
                  {totalRejectedPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground font-semibold">
                        Showing {rejectedStartIndex + 1} to {Math.min(rejectedStartIndex + itemsPerPage, rejectedDrafts.length)} of {rejectedDrafts.length} rejected
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setRejectedPage((p) => Math.max(1, p - 1))}
                          disabled={rejectedPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold px-2">
                          Page {rejectedPage} of {totalRejectedPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setRejectedPage((p) => Math.min(totalRejectedPages, p + 1))}
                          disabled={rejectedPage === totalRejectedPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* --- EDIT DRAFT DIALOG --- */}
      <Dialog open={editingDraft !== null} onOpenChange={(open) => !open && setEditingDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              <span>Edit AI Generated Draft</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full min-h-[160px] p-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium leading-relaxed bg-background"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={6}
              maxLength={280}
            />
            <p className="text-right text-xs text-muted-foreground mt-1 font-semibold">
              {280 - editedContent.length} characters remaining
            </p>
            {editingDraft?.collectedPost && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Attached Media</p>
                {renderMedia(editingDraft.collectedPost)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingDraft(null)} className="h-9 cursor-pointer">
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSave} className="h-9 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- SCHEDULE DRAFT DIALOG --- */}
      <Dialog open={schedulingDraft !== null} onOpenChange={(open) => !open && setSchedulingDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <span>Approve & Schedule Post</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
              Choose a date and time to publish this post to your linked platforms:
            </p>
            <input
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSchedulingDraft(null)} className="h-9 cursor-pointer">
              Cancel
            </Button>
            <Button size="sm" onClick={handleScheduleSubmit} className="h-9 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white">
              Confirm Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
