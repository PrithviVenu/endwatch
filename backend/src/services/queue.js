import Queue from "bull";
import { logger } from "../utils/logger.js";
import { runChecksForUrls } from "./monitor.js";

let urlChecksQueue = null;
let processorStarted = false;

function getQueue() {
  if (!urlChecksQueue) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    if (!process.env.REDIS_URL) {
      logger.warn("REDIS_URL not set; using redis://localhost:6379 for Bull queue");
    }
    urlChecksQueue = new Queue("url-checks", redisUrl);
  }
  return urlChecksQueue;
}

export async function addCheckJob(urls) {
  return getQueue().add({ urls });
}

export function processQueue() {
  if (processorStarted) return;
  processorStarted = true;

  const q = getQueue();

  q.process(async (job) => {
    const { urls } = job.data;
    if (!Array.isArray(urls)) {
      throw new Error("Job data must contain a urls array");
    }
    return runChecksForUrls(urls);
  });

  q.on("completed", (job, result) => {
    logger.info({
      msg: "url-check job completed",
      jobId: job.id,
      urlCount: job.data?.urls?.length,
      resultsReturned: Array.isArray(result) ? result.length : undefined,
    });
  });

  q.on("failed", (job, err) => {
    logger.error({
      msg: "url-check job failed",
      jobId: job?.id,
      error: err?.message ?? String(err),
      stack: err?.stack,
    });
  });
}
