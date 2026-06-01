import "./content-fetcher";
import "./ai-processor";
import "./post-publisher";
import db from "@/lib/db";
import { contentFetcherQueue } from "../config";

console.log("Queue workers started successfully.");
console.log(`[Startup] NITTER_INSTANCE_URL: ${process.env.NITTER_INSTANCE_URL}`);

async function triggerFetchOnStartup() {
  try {
    console.log("[Startup] Redeployment detected. Triggering fetch for active sources immediately...");
    const activeSources = await db.contentSource.findMany({
      where: { isActive: true },
    });

    if (activeSources.length === 0) {
      console.log("[Startup] No active content sources found to fetch.");
      return;
    }

    for (const source of activeSources) {
      // Generate a unique job ID to ensure it is executed immediately without collisions
      const jobId = `manual-fetch-${source.id}-${Date.now()}`;
      await contentFetcherQueue.add(jobId, { sourceId: source.id });
      console.log(`- Queued immediate fetch for source "${source.value}" (Job ID: ${jobId})`);
    }
    console.log("[Startup] All active source fetch jobs successfully queued!");
  } catch (err) {
    console.error("[Startup] Error triggering active source fetches:", err);
  }
}

triggerFetchOnStartup();
