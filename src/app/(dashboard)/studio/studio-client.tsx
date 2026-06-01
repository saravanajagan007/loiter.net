"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, User, Sparkles, Loader2, Calendar, Edit3, Save, X, Trash2 } from "lucide-react";
import { generateAIVersion, approvePost, rejectPost, updateDraftContent, deleteCollectedPost, deleteCollectedPosts } from "./actions";
import { PlatformType } from "@prisma/client";
import { toast } from "sonner";

interface CollectedPost {
  id: string;
  sourceType: string;
  authorHandle: string | null;
  content: string;
  postedAt: Date;
}

interface GeneratedPost {
  id: string;
  tone: string | null;
  status: string;
  generatedContent: string;
  originalContent: string | null;
  collectedPost: CollectedPost | null;
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
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [remixingTone, setRemixingTone] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // For scheduling later
  const [scheduleLaterMap, setScheduleLaterMap] = useState<Record<string, boolean>>({});
  const [scheduleTimeMap, setScheduleTimeMap] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");

  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  
  const handleRemix = (postId: string, tone: string) => {
    setRemixingId(postId);
    setRemixingTone(tone);
    startTransition(async () => {
      try {
        const result = await generateAIVersion(postId, tone);
        if (result.success) {
          toast.success("AI draft generated successfully!");
          setActiveTab("drafts");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to generate AI version.");
      } finally {
        setRemixingId(null);
        setRemixingTone(null);
      }
    });
  };

  const handleApprove = (draftId: string) => {
    setActioningId(draftId);
    
    const isLater = scheduleLaterMap[draftId];
    const timeVal = scheduleTimeMap[draftId];
    
    let scheduledTime: Date = new Date();
    if (isLater) {
      if (!timeVal) {
        toast.error("Please select a date and time to schedule the post.");
        setActioningId(null);
        return;
      }
      scheduledTime = new Date(timeVal);
      if (scheduledTime.getTime() <= Date.now()) {
        toast.error("Scheduled time must be in the future.");
        setActioningId(null);
        return;
      }
    }

    startTransition(async () => {
      try {
        await approvePost(draftId, PlatformType.X, scheduledTime);
        toast.success(isLater ? "Post scheduled successfully!" : "Post published successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to approve post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  const handleReject = (draftId: string) => {
    setActioningId(draftId);
    startTransition(async () => {
      try {
        const result = await rejectPost(draftId);
        if (result.success) {
          toast.success("Draft dismissed.");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to reject draft.");
      } finally {
        setActioningId(null);
      }
    });
  };

  const handleSave = (draftId: string) => {
    setActioningId(draftId);
    startTransition(async () => {
      try {
        const result = await updateDraftContent(draftId, editedContent);
        if (result.success) {
          toast.success("Draft updated successfully!");
          setEditingId(null);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to update draft.");
      } finally {
        setActioningId(null);
      }
    });
  };

  const handleDeleteCollected = (postId: string) => {
    setActioningId(postId);
    startTransition(async () => {
      try {
        const result = await deleteCollectedPost(postId);
        if (result.success) {
          toast.success("Post removed from Discovery.");
          setSelectedPostIds(prev => prev.filter(id => id !== postId));
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to remove post.");
      } finally {
        setActioningId(null);
      }
    });
  };

  const handleBulkDeleteCollected = () => {
    if (selectedPostIds.length === 0) return;
    setActioningId("bulk-delete");
    startTransition(async () => {
      try {
        const result = await deleteCollectedPosts(selectedPostIds);
        if (result.success) {
          toast.success(`${selectedPostIds.length} posts removed from Discovery.`);
          setSelectedPostIds([]);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to remove selected posts.");
      } finally {
        setActioningId(null);
      }
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full max-w-[400px] grid-cols-2">
        <TabsTrigger value="discovery">Discovery ({collectedPosts.length})</TabsTrigger>
        <TabsTrigger value="drafts">Drafts ({generatedPosts.length})</TabsTrigger>
      </TabsList>


      <TabsContent value="discovery" className="space-y-4">
        {collectedPosts.length > 0 && (
          <div className="flex items-center justify-between bg-muted/20 p-3 rounded-xl border border-border/50 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={collectedPosts.length > 0 && selectedPostIds.length === collectedPosts.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPostIds(collectedPosts.map((post) => post.id));
                    } else {
                      setSelectedPostIds([]);
                    }
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                Select All
              </label>
              {selectedPostIds.length > 0 && (
                <span className="text-xs font-bold text-foreground/80 bg-primary/10 px-2.5 py-1 rounded-full">
                  {selectedPostIds.length} Selected
                </span>
              )}
            </div>

            {selectedPostIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                onClick={handleBulkDeleteCollected}
                disabled={actioningId !== null}
              >
                {actioningId === "bulk-delete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete Selected
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collectedPosts.length === 0 ? (
            <div className="col-span-full py-16 text-center border border-dashed rounded-xl text-muted-foreground bg-muted/20">
              No content collected yet. Add sources to get started.
            </div>
          ) : (
            collectedPosts.map((post) => {
              const isSelected = selectedPostIds.includes(post.id);
              return (
                <Card 
                  key={post.id} 
                  className={`flex flex-col transition-all duration-200 shadow-xs hover:shadow-md ${
                    isSelected ? "border-primary/50 bg-primary/5" : "hover:border-foreground/20"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPostIds((prev) => [...prev, post.id]);
                            } else {
                              setSelectedPostIds((prev) => prev.filter((id) => id !== post.id));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <Badge variant="secondary" className="font-semibold text-xs tracking-wider uppercase">{post.sourceType}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.postedAt).toLocaleDateString()}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteCollected(post.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0 rounded-full"
                          disabled={actioningId !== null}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {post.authorHandle || "Anonymous"}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <p className="text-sm line-clamp-5 text-muted-foreground leading-relaxed italic">&quot;{post.content}&quot;</p>
                </CardContent>
                <CardFooter className="pt-3 border-t bg-muted/20 flex flex-col gap-2 rounded-b-xl">
                  <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase self-start mb-1">
                    AI Remix
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {TONES.map((tone) => {
                      const isThisRemixing = remixingId === post.id && remixingTone === tone.value;
                      const isAnyRemixing = remixingId !== null;
                      return (
                        <Button
                          key={tone.value}
                          variant="outline"
                          size="sm"
                          className="w-full text-xs hover:bg-primary hover:text-primary-foreground font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                          onClick={() => handleRemix(post.id, tone.value)}
                          disabled={isAnyRemixing || actioningId !== null}
                        >
                          {isThisRemixing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <span>{tone.icon}</span>
                          )}
                          <span>{isThisRemixing ? "Remixing" : tone.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardFooter>
              </Card>
            );
          })
          )}
        </div>
      </TabsContent>

      <TabsContent value="drafts" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {generatedPosts.length === 0 ? (
            <div className="col-span-full py-16 text-center border border-dashed rounded-xl text-muted-foreground bg-muted/20">
              No drafts generated yet. Use the remix buttons in the Discovery tab.
            </div>
          ) : (
            generatedPosts.map((draft) => {
              const isActioning = actioningId === draft.id;
              const isLater = scheduleLaterMap[draft.id] || false;
              const timeVal = scheduleTimeMap[draft.id] || "";
              
              // Define dynamic styling variables based on post status
              let cardStyles = "border-primary/20 hover:border-primary/40 transition-all duration-200 shadow-xs";
              let contentStyles = "p-4 bg-muted rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium border";
              let statusBadge = (
                <Badge variant="secondary" className="text-xs font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20">
                  DRAFT
                </Badge>
              );
              let footerBg = "bg-muted/20";

              if (draft.status === "APPROVED") {
                cardStyles = "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/40 opacity-90 transition-all duration-200 shadow-xs";
                contentStyles = "p-4 bg-emerald-500/5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium border border-emerald-500/10 text-emerald-800";
                statusBadge = (
                  <Badge variant="default" className="text-xs font-semibold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-none">
                    <CheckCircle2 className="mr-1 h-3 w-3 inline text-emerald-500" /> APPROVED
                  </Badge>
                );
                footerBg = "bg-emerald-500/10";
              } else if (draft.status === "REJECTED") {
                cardStyles = "border-border/60 bg-muted/40 opacity-70 hover:opacity-85 transition-all duration-200 shadow-xs";
                contentStyles = "p-4 bg-muted/60 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium border text-muted-foreground/85 line-through decoration-muted-foreground/50 decoration-1";
                statusBadge = (
                  <Badge variant="destructive" className="text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/15 border border-destructive/20 shadow-none">
                    <XCircle className="mr-1 h-3 w-3 inline text-destructive/80" /> REJECTED
                  </Badge>
                );
                footerBg = "bg-destructive/5";
              }

              return (
                <Card key={draft.id} className={cardStyles}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className="capitalize font-semibold tracking-wider">
                        <Sparkles className="mr-1 h-3.5 w-3.5 text-yellow-400" /> {draft.tone}
                      </Badge>
                      {statusBadge}
                    </div>
                    {draft.collectedPost && (
                      <CardDescription className="mt-2 line-clamp-1 italic text-xs">
                        Based on: {draft.collectedPost.authorHandle ? `@${draft.collectedPost.authorHandle}: ` : ""}{draft.collectedPost.content}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    {editingId === draft.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full min-h-[120px] p-3 bg-background rounded-xl text-sm leading-relaxed border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                          rows={4}
                          maxLength={500}
                          disabled={isActioning}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="text-xs h-8 flex items-center gap-1 cursor-pointer"
                            disabled={isActioning}
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(draft.id)}
                            className="text-xs h-8 flex items-center gap-1 cursor-pointer"
                            disabled={isActioning}
                          >
                            <Save className="h-3.5 w-3.5" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group">
                        <div className={contentStyles}>
                          {draft.generatedContent}
                        </div>
                        {draft.status === "DRAFT" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(draft.id);
                              setEditedContent(draft.generatedContent);
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/80 hover:bg-background h-8 px-2 flex items-center gap-1 text-xs border border-border cursor-pointer shadow-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {draft.status === "DRAFT" && (
                      <div className="mt-4 p-3 border rounded-lg bg-card space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isLater}
                              onChange={(e) => {
                                setScheduleLaterMap({ ...scheduleLaterMap, [draft.id]: e.target.checked });
                                if (e.target.checked && !timeVal) {
                                  // Default to 1 hour from now formatted as local datetime string
                                  const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
                                  const localISO = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                  setScheduleTimeMap({ ...scheduleTimeMap, [draft.id]: localISO });
                                }
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            Schedule for later
                          </label>
                        </div>
                        {isLater && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <input
                              type="datetime-local"
                              value={timeVal}
                              onChange={(e) => setScheduleTimeMap({ ...scheduleTimeMap, [draft.id]: e.target.value })}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isActioning}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className={`pt-3 border-t flex gap-2 rounded-b-xl ${footerBg}`}>
                    {draft.status === "DRAFT" ? (
                      <>
                        <Button
                          className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
                          disabled={isActioning || remixingId !== null}
                          onClick={() => handleApprove(draft.id)}
                        >
                          {isActioning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>{isLater ? "Approve & Schedule" : "Approve & Post Now"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isActioning || remixingId !== null}
                          onClick={() => handleReject(draft.id)}
                          className="hover:bg-destructive/10 hover:text-destructive cursor-pointer shrink-0"
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : draft.status === "APPROVED" ? (
                      <div className="text-xs text-emerald-700 font-semibold py-1 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Approved. Post is queued/scheduled in the Scheduler.
                      </div>
                    ) : (
                      <div className="text-xs text-destructive/80 font-semibold py-1 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-destructive" />
                        Rejected. Post is dismissed and won&apos;t be published.
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
