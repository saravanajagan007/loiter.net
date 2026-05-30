import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { SourceType } from "@prisma/client";
import { addSource, deleteSource } from "./actions";
import { Badge } from "@/components/ui/badge";
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
                  <Input id="value" name="value" placeholder="@naval or #AI" required />
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                    No sources added yet.
                  </TableCell>
                </TableRow>
              ) : (
                sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <Badge variant="outline">{source.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{source.value}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${source.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {source.isActive ? 'Active' : 'Paused'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {source.lastPolledAt ? new Date(source.lastPolledAt).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form action={async () => { "use server"; await deleteSource(source.id); }}>
                          <Button variant="ghost" size="icon" type="submit">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </form>
                      </div>
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
