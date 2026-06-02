import "./content-fetcher";
import "./ai-processor";
import "./post-publisher";
import "./post-verifier";
import db from "@/lib/db";
import { contentFetcherQueue, postVerifierQueue } from "../config";

console.log("Queue workers started successfully.");
console.log(`[Startup] NITTER_INSTANCE_URL: ${process.env.NITTER_INSTANCE_URL}`);

async function triggerFetchOnStartup() {
  try {
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

async function setupVerificationCron() {
  try {
    const repeatableJobs = await postVerifierQueue.getRepeatableJobs();
    const hasJob = repeatableJobs.some(job => job.id === "verify-posts-job" || job.name === "verify-posts-job");
    if (!hasJob) {
      await postVerifierQueue.add(
        "verify-posts-job",
        {},
        {
          repeat: { every: 60 * 1000 }, // Run every 60 seconds
          jobId: "verify-posts-job",
        }
      );
      console.log("[Startup] Post verification cron scheduled to run every 60 seconds.");
    }
  } catch (err) {
    console.error("[Startup] Failed to setup post verification cron:", err);
  }
}

triggerFetchOnStartup();
setupVerificationCron();
