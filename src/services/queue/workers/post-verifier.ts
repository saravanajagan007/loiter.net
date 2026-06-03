import { Worker, Job } from "bullmq";
import { QUEUES, workerOptions } from "../config";
import db from "@/lib/db";
import { getSocialProvider } from "../../social";
import { QueueStatus } from "@prisma/client";

export const postVerifierWorker = new Worker(
  QUEUES.POST_VERIFIER,
  async (job: Job) => {
    console.log("[Verifier Worker] Checking posts in VERIFYING status...");
    
    // Find all queued posts that are in VERIFYING status
    const verifyingPosts = await db.queuedPost.findMany({
      where: { status: "VERIFYING" as any },
      include: {
        workspace: { 
          include: { 
            socialAccounts: true,
            contentSources: true
          } 
        },
        generatedPost: {
          include: {
            collectedPost: true,
          },
        },
      },
    });

    if (verifyingPosts.length === 0) {
      console.log("[Verifier Worker] No posts currently require verification.");
      return;
    }

    for (const queuedPost of verifyingPosts) {
      try {
        console.log(`[Verifier Worker] Verifying post ${queuedPost.id}...`);

        // Check if the post has been in VERIFYING state for more than 1 hour
        const now = new Date();
        const updatedAtTime = new Date(queuedPost.updatedAt).getTime();
        const timeElapsedMs = now.getTime() - updatedAtTime;
        const oneHourMs = 60 * 60 * 1000;

        if (timeElapsedMs > oneHourMs) {
          console.log(`[Verifier Worker] Post ${queuedPost.id} has exceeded the 1 hour verification window. Marking as FAILED.`);
          await db.queuedPost.update({
            where: { id: queuedPost.id },
            data: {
              status: QueueStatus.FAILED,
              errorMessage: "Verification timed out. The post was not found on your profile within 1 hour."
            }
          });
          continue;
        }
        
        // Find X social account to fetch user timeline
        const account = queuedPost.workspace.socialAccounts.find(
          (a) => a.platform === queuedPost.platform
        );

        let handle = account?.handle;
        let token = account?.accessToken || "";

        if (!handle) {
          // Fallback: Check if there's any active HANDLE type content source in the workspace
          const firstHandleSource = queuedPost.workspace.contentSources.find(
            (s) => s.type === "HANDLE" && s.isActive
          );
          if (firstHandleSource) {
            handle = firstHandleSource.value.replace("@", "");
            console.log(`[Verifier Worker] No connected account found. Falling back to active content source handle: @${handle}`);
          }
        }

        if (!handle) {
          console.warn(`[Verifier Worker] No handle found for connected platform ${queuedPost.platform} in workspace ${queuedPost.workspaceId}`);
          continue;
        }

        const provider = getSocialProvider(queuedPost.platform);
        
        // Fetch recent posts from the user's timeline (e.g. limit to 50)
        console.log(`[Verifier Worker] Fetching timeline for user @${handle}...`);
        const recentPosts = await provider.fetchUserPosts(token, handle, 50);
        
        const draftContent = queuedPost.generatedPost.generatedContent;
        let isPublished = false;
        let externalId = "";

        // Check if any of the recent posts match the draft content
        for (const recentPost of recentPosts) {
          if (matchesContent(draftContent, recentPost.content)) {
            isPublished = true;
            externalId = recentPost.externalId;
            break;
          }
        }

        if (isPublished) {
          console.log(`[Verifier Worker] Post ${queuedPost.id} verified as PUBLISHED on profile! External ID: ${externalId}`);
          
          await db.$transaction(async (tx) => {
            // Update queuedPost status to PUBLISHED
            await tx.queuedPost.update({
              where: { id: queuedPost.id },
              data: { status: QueueStatus.PUBLISHED },
            });

            // Create publishedPost record if not already exists
            const existingPublished = await tx.publishedPost.findUnique({
              where: { queuedPostId: queuedPost.id },
            });

            if (!existingPublished) {
              await tx.publishedPost.create({
                data: {
                  workspaceId: queuedPost.workspaceId,
                  queuedPostId: queuedPost.id,
                  platform: queuedPost.platform,
                  externalId: externalId || Math.random().toString(36).substring(7),
                },
              });
            }
          });
        } else {
          console.log(`[Verifier Worker] Post ${queuedPost.id} not found on profile yet. Retrying in next cycle.`);
        }
      } catch (err: any) {
        console.error(`[Verifier Worker] Error verifying post ${queuedPost.id}:`, err.message);
      }
    }
  },
  workerOptions
);

// Normalize and match content
function matchesContent(draftContent: string, tweetContent: string): boolean {
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/#\w+/g, "")
      .replace(/@\w+/g, "")
      .replace(/[^a-z0-9\u0B80-\u0BFF]/g, "")
      .trim();
  };
  const normDraft = normalize(draftContent);
  const normTweet = normalize(tweetContent);

  if (!normDraft || !normTweet) return false;
  return normDraft.includes(normTweet) || normTweet.includes(normDraft);
}
