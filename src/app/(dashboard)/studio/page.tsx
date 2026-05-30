import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, User, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateAIVersion, approvePost, rejectPost } from "./actions";
import { Badge } from "@/components/ui/badge";
import { PlatformType } from "@prisma/client";

const TONES = [
  { value: "viral", label: "Viral", icon: "🚀" },
  { value: "professional", label: "Pro", icon: "💼" },
  { value: "humorous", label: "Funny", icon: "😂" },
  { value: "educational", label: "Learn", icon: "📚" },
];

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const collectedPosts = await db.collectedPost.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { postedAt: "desc" },
    take: 20,
  });

  const generatedPosts = await db.generatedPost.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { collectedPost: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Content Studio</h1>
        <p className="text-muted-foreground">Review collected content and generate AI-powered social posts.</p>
      </div>

      <Tabs defaultValue="discovery" className="space-y-4">
        <TabsList>
          <TabsTrigger value="discovery">Discovery ({collectedPosts.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({generatedPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="discovery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collectedPosts.length === 0 ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                No content collected yet. Add sources to get started.
              </div>
            ) : (
              collectedPosts.map((post) => (
                <Card key={post.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{post.sourceType}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.postedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4" />
                      {post.authorHandle || "Anonymous"}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm line-clamp-4 text-muted-foreground italic">&quot;{post.content}&quot;</p>
                  </CardContent>
                  <CardFooter className="pt-2 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      {TONES.map((tone) => (
                        <form key={tone.value} action={async () => { "use server"; await generateAIVersion(post.id, tone.value); }}>
                          <Button variant="outline" size="sm" className="w-full text-xs" type="submit">
                            {tone.icon} {tone.label}
                          </Button>
                        </form>
                      ))}
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {generatedPosts.length === 0 ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                No drafts generated yet. Use one of the remix buttons in the Discovery tab.
              </div>
            ) : (
              generatedPosts.map((draft) => (
                <Card key={draft.id} className="border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge className="capitalize">
                        <Sparkles className="mr-1 h-3 w-3" /> {draft.tone}
                      </Badge>
                      <Badge variant={draft.status === "APPROVED" ? "default" : "secondary"}>
                        {draft.status}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2 line-clamp-1 italic">
                      Based on: {draft.originalContent || "Original content"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {draft.generatedContent}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    {draft.status === "DRAFT" && (
                      <>
                        <form action={async () => { "use server"; await approvePost(draft.id, PlatformType.X, new Date()); }} className="flex-1">
                          <Button className="w-full" type="submit">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Post
                          </Button>
                        </form>
                        <form action={async () => { "use server"; await rejectPost(draft.id); }}>
                          <Button variant="ghost" size="icon" type="submit">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </form>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
