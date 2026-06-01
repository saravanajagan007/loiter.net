import db from "../lib/db";
import { contentFetcherQueue } from "../services/queue/config";

async function main() {
  console.log("Fetching all active content sources from database...");
  const sources = await db.contentSource.findMany({
    where: { isActive: true },
  });

  if (sources.length === 0) {
    console.log("No active content sources found.");
    return;
  }

  console.log(`Found ${sources.length} active source(s). Triggering fetch jobs in queue...`);
  for (const source of sources) {
    // Generate a unique job ID to ensure it is processed immediately by BullMQ
    const jobId = `manual-fetch-${source.id}-${Date.now()}`;
    await contentFetcherQueue.add(jobId, { sourceId: source.id });
    console.log(`- Triggered fetch job for source "${source.value}" (Job ID: ${jobId})`);
  }

  console.log("All fetch jobs successfully queued!");
}

main()
  .catch(console.error)
  .finally(() => process.exit());
