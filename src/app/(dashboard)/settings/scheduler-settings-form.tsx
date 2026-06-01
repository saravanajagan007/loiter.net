"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateFetchInterval } from "./actions";
import { toast } from "sonner";

interface SchedulerSettingsFormProps {
  initialInterval: number;
}

export function SchedulerSettingsForm({ initialInterval }: SchedulerSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [intervalValue, setIntervalValue] = useState(initialInterval);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const value = parseInt(formData.get("fetchInterval") as string, 10);
    if (isNaN(value) || value < 1) {
      setError("Fetch interval must be at least 1 minute.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateFetchInterval(formData);
        if (result.success) {
          toast.success("Fetch interval updated successfully!");
        } else {
          setError("Failed to update fetch interval.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while updating the interval.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduler Settings</CardTitle>
        <CardDescription>
          Configure how often the background scheduler fetches content from your active sources.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="fetchInterval">Fetch Interval (in minutes)</Label>
            <Input
              id="fetchInterval"
              name="fetchInterval"
              type="number"
              min="1"
              value={intervalValue}
              onChange={(e) => setIntervalValue(parseInt(e.target.value, 10) || 0)}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Minimum interval is 1 minute. Default is 60 minutes.
            </p>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
