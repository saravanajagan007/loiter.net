import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SourceType } from "@prisma/client";
import { addSource } from "./actions";
import { SourcesList } from "./sources-list";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default async function SourcesPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const sources = await db.contentSource.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Sources</h1>
          <p className="text-muted-foreground">Manage the accounts and topics you want to monitor for content.</p>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Source
              </Button>
            }
          />
          <DialogContent>
            <form action={addSource}>
              <DialogHeader>
                <DialogTitle>Add Content Source</DialogTitle>
                <DialogDescription>
                  Choose a source type and enter the value (e.g., @username, #hashtag).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Source Type</Label>
                  <Select name="type" defaultValue={SourceType.HANDLE}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SourceType.HANDLE}>Twitter Handle (@)</SelectItem>
                      <SelectItem value={SourceType.HASHTAG}>Hashtag (#)</SelectItem>
                      <SelectItem value={SourceType.KEYWORD}>Keyword</SelectItem>
                      <SelectItem value={SourceType.RSS}>RSS Feed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value</Label>
                  <Input id="value" name="value" placeholder="@naval, @pmarca or #AI" required />
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    For Twitter Handles, you can enter multiple values separated by commas (e.g. @naval, @pmarca).
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Source</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Sources</CardTitle>
          <CardDescription>All sources being polled for content.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourcesList sources={sources} />
        </CardContent>
      </Card>
    </div>
  );
}
