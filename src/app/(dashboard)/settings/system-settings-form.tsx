"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSystemSettings } from "./actions";
import { toast } from "sonner";

interface SystemSettingsFormProps {
  initialSettings: {
    AI_PROVIDER: string;
    GEMINI_API_KEY: string;
    GEMINI_MODEL: string;
    OPENAI_API_KEY: string;
    X_CLIENT_ID: string;
    X_CLIENT_SECRET: string;
    X_CALLBACK_URL: string;
    NITTER_INSTANCE_URL: string;
    PUBLISHING_PROVIDER: string;
    BUFFER_ACCESS_TOKEN: string;
    BUFFER_PROFILE_ID: string;
  };
}

export function SystemSettingsForm({ initialSettings }: SystemSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [aiProvider, setAiProvider] = useState(initialSettings.AI_PROVIDER || "gemini");
  const [geminiModel, setGeminiModel] = useState(initialSettings.GEMINI_MODEL || "");
  const [xCallbackUrl, setXCallbackUrl] = useState(initialSettings.X_CALLBACK_URL || "");
  const [nitterInstanceUrl, setNitterInstanceUrl] = useState(initialSettings.NITTER_INSTANCE_URL || "");
  const [publishingProvider, setPublishingProvider] = useState(initialSettings.PUBLISHING_PROVIDER || "native");
  const [bufferProfileId, setBufferProfileId] = useState(initialSettings.BUFFER_PROFILE_ID || "");

  const getMaskedValue = (val: string) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return `${val.substring(0, 4)}••••••••${val.substring(val.length - 4)}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await updateSystemSettings(formData);
        if (result.success) {
          toast.success("System settings updated successfully!");
        } else {
          setError("Failed to update system settings.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while updating the settings.");
      }
    });
  };

  return (
    <Card className="border border-border bg-card shadow-lg relative overflow-hidden transition-all duration-300 hover:shadow-xl">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600" />
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <span>⚙️ System Configuration</span>
        </CardTitle>
        <CardDescription>
          Dynamically manage global credentials, models, and integration endpoints. These values are securely stored in MySQL and take precedence over local environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          {/* AI Settings Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 tracking-wide uppercase text-muted-foreground/80">
              AI Generation Settings
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="AI_PROVIDER" className="text-sm font-medium">Active AI Provider</Label>
                <select
                  id="AI_PROVIDER"
                  name="AI_PROVIDER"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  disabled={isPending}
                >
                  <option value="gemini">Gemini API (Recommended)</option>
                  <option value="openai">OpenAI API</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="GEMINI_MODEL" className="text-sm font-medium">Gemini Model Override</Label>
                <Input
                  id="GEMINI_MODEL"
                  name="GEMINI_MODEL"
                  type="text"
                  placeholder="e.g. gemini-2.5-pro (default: gemini-2.5-flash)"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="GEMINI_API_KEY" className="text-sm font-medium">Gemini API Key</Label>
                <Input
                  id="GEMINI_API_KEY"
                  name="GEMINI_API_KEY"
                  type="password"
                  placeholder={initialSettings.GEMINI_API_KEY ? getMaskedValue(initialSettings.GEMINI_API_KEY) : "Enter Gemini API Key"}
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="OPENAI_API_KEY" className="text-sm font-medium">OpenAI API Key</Label>
                <Input
                  id="OPENAI_API_KEY"
                  name="OPENAI_API_KEY"
                  type="password"
                  placeholder={initialSettings.OPENAI_API_KEY ? getMaskedValue(initialSettings.OPENAI_API_KEY) : "Enter OpenAI API Key"}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Social Settings Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 tracking-wide uppercase text-muted-foreground/80">
              Social Integrations & Twitter (X)
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="X_CLIENT_ID" className="text-sm font-medium">X (Twitter) Client ID</Label>
                <Input
                  id="X_CLIENT_ID"
                  name="X_CLIENT_ID"
                  type="text"
                  placeholder={initialSettings.X_CLIENT_ID ? getMaskedValue(initialSettings.X_CLIENT_ID) : "Enter X Client ID"}
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="X_CLIENT_SECRET" className="text-sm font-medium">X (Twitter) Client Secret</Label>
                <Input
                  id="X_CLIENT_SECRET"
                  name="X_CLIENT_SECRET"
                  type="password"
                  placeholder={initialSettings.X_CLIENT_SECRET ? getMaskedValue(initialSettings.X_CLIENT_SECRET) : "Enter X Client Secret"}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="X_CALLBACK_URL" className="text-sm font-medium">X (Twitter) OAuth Callback URL</Label>
                <Input
                  id="X_CALLBACK_URL"
                  name="X_CALLBACK_URL"
                  type="url"
                  placeholder="e.g. http://localhost:3000/api/social/callback/x"
                  value={xCallbackUrl}
                  onChange={(e) => setXCallbackUrl(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="NITTER_INSTANCE_URL" className="text-sm font-medium">Nitter RSS Instance URL</Label>
                <Input
                  id="NITTER_INSTANCE_URL"
                  name="NITTER_INSTANCE_URL"
                  type="url"
                  placeholder="e.g. https://nitter.privacyredirect.com"
                  value={nitterInstanceUrl}
                  onChange={(e) => setNitterInstanceUrl(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
            </div>
          </div>

          {/* Publishing Provider & Buffer Settings Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 tracking-wide uppercase text-muted-foreground/80">
              Publishing Provider & Buffer Configuration
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="PUBLISHING_PROVIDER" className="text-sm font-medium">Publishing Method</Label>
                <select
                  id="PUBLISHING_PROVIDER"
                  name="PUBLISHING_PROVIDER"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={publishingProvider}
                  onChange={(e) => setPublishingProvider(e.target.value)}
                  disabled={isPending}
                >
                  <option value="native">Native X (Twitter) API</option>
                  <option value="buffer">Buffer API (Free Scheduling)</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="BUFFER_PROFILE_ID" className="text-sm font-medium">Buffer Profile ID (Twitter)</Label>
                <Input
                  id="BUFFER_PROFILE_ID"
                  name="BUFFER_PROFILE_ID"
                  type="text"
                  placeholder="e.g. 64a82b9..."
                  value={bufferProfileId}
                  onChange={(e) => setBufferProfileId(e.target.value)}
                  disabled={isPending || publishingProvider !== "buffer"}
                  required={publishingProvider === "buffer"}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="BUFFER_ACCESS_TOKEN" className="text-sm font-medium">Buffer Access Token</Label>
                <Input
                  id="BUFFER_ACCESS_TOKEN"
                  name="BUFFER_ACCESS_TOKEN"
                  type="password"
                  placeholder={initialSettings.BUFFER_ACCESS_TOKEN ? getMaskedValue(initialSettings.BUFFER_ACCESS_TOKEN) : "Enter Buffer Access Token"}
                  disabled={isPending || publishingProvider !== "buffer"}
                  required={publishingProvider === "buffer" && !initialSettings.BUFFER_ACCESS_TOKEN}
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 transition-all duration-200" 
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save System Config"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
