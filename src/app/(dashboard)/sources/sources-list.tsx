"use client";

import { useTransition, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { deleteSource, toggleSource, triggerManualFetch } from "./actions";
import { toast } from "sonner";

interface Source {
  id: string;
  type: string;
  value: string;
  isActive: boolean;
  lastPolledAt: Date | null;
  createdAt: Date;
}

export function SourcesList({ sources }: { sources: Source[] }) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pullingId, setPullingId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(sources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSources = sources.slice(startIndex, startIndex + itemsPerPage);

  const handleToggle = (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    const newStatus = !currentStatus;
    startTransition(async () => {
      try {
        await toggleSource(id, newStatus);
        toast.success(newStatus ? "Source resumed successfully" : "Source paused successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to update source status.");
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteSource(id);
        toast.success("Source deleted successfully");
        // Adjust page if deleting last item of current page
        if (paginatedSources.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to delete source.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handlePullNow = (id: string) => {
    setPullingId(id);
    startTransition(async () => {
      try {
        await triggerManualFetch(id);
        toast.success("Immediate fetch task queued successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to trigger fetch.");
      } finally {
        setPullingId(null);
      }
    });
  };

  const getPlatformName = (type: string) => {
    if (type === "RSS" || type === "URL") {
      return "RSS Feed";
    }
    return "Twitter/X";
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Polled</TableHead>
            <TableHead>On-Demand Pull</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSources.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground h-28 bg-muted/10 rounded-b-xl border-dashed">
                No sources added yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedSources.map((source) => {
              const isDeleting = deletingId === source.id;
              const isToggling = togglingId === source.id;
              const isPulling = pullingId === source.id;
              return (
                <TableRow key={source.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-semibold text-xs tracking-wider uppercase">{source.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">
                    <Badge className="bg-sky-500/10 text-sky-600 border border-sky-500/20 shadow-none hover:bg-sky-500/15">
                      {getPlatformName(source.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground text-sm">{source.value}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={source.isActive}
                        onCheckedChange={() => handleToggle(source.id, source.isActive)}
                        disabled={isPending}
                      />
                      <span className="text-sm font-medium text-muted-foreground min-w-[70px]">
                        {isToggling ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating...
                          </span>
                        ) : source.isActive ? (
                          "Active"
                        ) : (
                          "Paused"
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {source.lastPolledAt ? new Date(source.lastPolledAt).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || !source.isActive}
                      onClick={() => handlePullNow(source.id)}
                      className="flex items-center gap-1.5 h-8 font-semibold text-xs border-primary/20 text-primary hover:bg-primary/5 hover:text-primary cursor-pointer transition-colors"
                      title="Pull content now"
                    >
                      {isPulling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>Pull Now</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => handleDelete(source.id)}
                        className="hover:bg-destructive/10 hover:text-destructive cursor-pointer h-8 w-8"
                        title="Delete source"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-semibold">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sources.length)} of {sources.length} sources
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
