import db from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Plus } from "lucide-react";
import { connectX, disconnectAccount } from "./actions";
import { SchedulerSettingsForm } from "./scheduler-settings-form";
import { SystemSettingsForm } from "./system-settings-form";
import { getSystemSetting } from "@/lib/settings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.workspaceId) return null;

  const socialAccounts = await db.socialAccount.findMany({
    where: { workspaceId: session.user.workspaceId },
  });

  const workspace = await db.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: { fetchInterval: true },
  });

  const [
    aiProvider,
    geminiApiKey,
    geminiModel,
    openaiApiKey,
    xClientId,
    xClientSecret,
    xCallbackUrl,
    nitterInstanceUrl,
    publishingProvider,
    bufferAccessToken,
    bufferProfileId
  ] = await Promise.all([
    getSystemSetting("AI_PROVIDER"),
    getSystemSetting("GEMINI_API_KEY"),
    getSystemSetting("GEMINI_MODEL"),
    getSystemSetting("OPENAI_API_KEY"),
    getSystemSetting("X_CLIENT_ID"),
    getSystemSetting("X_CLIENT_SECRET"),
    getSystemSetting("X_CALLBACK_URL"),
    getSystemSetting("NITTER_INSTANCE_URL"),
    getSystemSetting("PUBLISHING_PROVIDER"),
    getSystemSetting("BUFFER_ACCESS_TOKEN"),
    getSystemSetting("BUFFER_PROFILE_ID"),
  ]);

  const initialSettings = {
    AI_PROVIDER: aiProvider,
    GEMINI_API_KEY: geminiApiKey,
    GEMINI_MODEL: geminiModel,
    OPENAI_API_KEY: openaiApiKey,
    X_CLIENT_ID: xClientId,
    X_CLIENT_SECRET: xClientSecret,
    X_CALLBACK_URL: xCallbackUrl,
    NITTER_INSTANCE_URL: nitterInstanceUrl,
    PUBLISHING_PROVIDER: publishingProvider || "native",
    BUFFER_ACCESS_TOKEN: bufferAccessToken || "",
    BUFFER_PROFILE_ID: bufferProfileId || "",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace connections and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Connect your social media accounts to enable posting and content collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {socialAccounts.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">No accounts connected yet.</p>
              <form action={connectX}>
                <Button type="submit">
                  <X className="mr-2 h-4 w-4" /> Connect X (Twitter)
                </Button>
              </form>
            </div>
          ) : (
            <div className="grid gap-4">
              {socialAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-sky-500/10 rounded-full">
                      <X className="h-4 w-4 text-sky-500" />
                    </div>
                    <div>
                      <p className="font-medium">@{account.handle}</p>
                      <p className="text-sm text-muted-foreground capitalize">{account.platform.toLowerCase()}</p>
                    </div>
                  </div>
                  <form action={async () => { "use server"; await disconnectAccount(account.id); }}>
                    <Button variant="ghost" size="icon" type="submit">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </div>
              ))}
              <form action={connectX}>
                <Button variant="outline" className="w-full" type="submit">
                  <Plus className="mr-2 h-4 w-4" /> Add Another Account
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <SchedulerSettingsForm initialInterval={workspace?.fetchInterval ?? 60} />

      <SystemSettingsForm initialSettings={initialSettings} />

      <Card>
        <CardHeader>
          <CardTitle>Workspace Profile</CardTitle>
          <CardDescription>
            General information about your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Workspace Name</label>
            <div className="p-2 border rounded bg-muted text-muted-foreground">
              Personal Workspace (Default)
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Workspace ID</label>
            <div className="p-2 border rounded bg-muted text-muted-foreground font-mono text-xs">
              {session.user.workspaceId}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
