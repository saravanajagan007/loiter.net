import { Queue, Worker, Job } from "bullmq";
import redis from "@/lib/redis";

// Queue names
export const QUEUES = {
  CONTENT_FETCHER: "content-fetcher",
  AI_PROCESSOR: "ai-processor",
  POST_PUBLISHER: "post-publisher",
  ANALYTICS_SYNC: "analytics-sync",
};

// Queue instances
export const contentFetcherQueue = new Queue(QUEUES.CONTENT_FETCHER, { connection: redis });
export const aiProcessorQueue = new Queue(QUEUES.AI_PROCESSOR, { connection: redis });
export const postPublisherQueue = new Queue(QUEUES.POST_PUBLISHER, { connection: redis });
export const analyticsSyncQueue = new Queue(QUEUES.ANALYTICS_SYNC, { connection: redis });

// Shared worker options
export const workerOptions = {
  connection: redis,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
