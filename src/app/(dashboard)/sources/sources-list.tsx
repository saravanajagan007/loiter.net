"use client";

import { useTransition, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSource, toggleSource } from "./actions";
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
      } catch (err: any) {
        toast.error(err.message || "Failed to delete source.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Polled</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sources.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground h-28 bg-muted/10 rounded-b-xl border-dashed">
              No sources added yet.
            </TableCell>
          </TableRow>
        ) : (
          sources.map((source) => {
            const isDeleting = deletingId === source.id;
            const isToggling = togglingId === source.id;
            return (
              <TableRow key={source.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <Badge variant="outline" className="font-semibold text-xs tracking-wider uppercase">{source.type}</Badge>
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
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleDelete(source.id)}
                    className="hover:bg-destructive/10 hover:text-destructive cursor-pointer h-8 w-8"
                  >
                    {isDeleting ? (
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
  );
}
