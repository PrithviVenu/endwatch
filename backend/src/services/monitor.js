import axios from "axios";
import { prisma } from "../lib/prisma.js";
import { sendDownAlert, sendRecoveryAlert } from "./email.js";
import { withCorrelationId } from "../utils/logger.js";

const NETWORK_RETRY_CODES = new Set(["ECONNABORTED", "ENOTFOUND", "ECONNREFUSED"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET health check for a URL row; persists a CheckResult and returns it. */
export async function checkUrl(url, correlationId) {
  const start = Date.now();
  let responseTime = null;
  let statusCode = null;
  let error = null;
  let status = "DOWN";
  let errorKind = null;
  const log = withCorrelationId(correlationId);

  let urlWithData = null;
  try {
    urlWithData = await prisma.url.findUnique({
      where: { id: url.id },
      include: {
        user: { select: { email: true } },
        checkResults: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
    });
  } catch {
    urlWithData = null;
  }

  const previousStatus = urlWithData?.checkResults?.[0]?.status;
  const userEmail = urlWithData?.user?.email;

  const maxRetries = 3; // after initial attempt (total attempts = 4)
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url.address, {
        timeout: 10_000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      responseTime = Date.now() - start;
      statusCode = res.status;
      status = res.status >= 200 && res.status < 300 ? "UP" : "DOWN";
      if (status === "DOWN") {
        error = `HTTP ${statusCode}`;
        errorKind = "http";
      } else {
        error = null;
        errorKind = null;
      }
      break; // never retry on HTTP responses (even DOWN)
    } catch (err) {
      responseTime = Date.now() - start;

      const code = err?.code;
      const isNetworkRetryable = NETWORK_RETRY_CODES.has(code);

      if (code === "ECONNABORTED") {
        error = "Timeout";
        errorKind = "timeout";
      } else if (code === "ENOTFOUND") {
        error = "DNS failure";
        errorKind = "dns";
      } else if (code === "ECONNREFUSED") {
        error = "Connection refused";
        errorKind = "connrefused";
      } else {
        error =
          err instanceof Error
            ? err.message
            : err != null
              ? String(err)
              : "Unknown error";
        errorKind = "unknown";
      }

      // Only retry on network errors; do not retry HTTP responses (validateStatus=true)
      if (!isNetworkRetryable || attempt === maxRetries) {
        if (isNetworkRetryable || errorKind === "dns" || errorKind === "timeout") {
          log.error({
            msg: "url.check.final_failure",
            urlId: url.id,
            address: url.address,
            attempt: attempt + 1,
            error,
          });
        }
        break;
      }

      const delayMs = baseDelayMs * 2 ** attempt; // 1s, 2s, 4s
      log.warn({
        msg: "url.check.retry",
        urlId: url.id,
        address: url.address,
        attempt: attempt + 1,
        error,
        nextRetryDelayMs: delayMs,
      });
      await sleep(delayMs);
    }
  }

  const saved = await prisma.checkResult.create({
    data: {
      urlId: url.id,
      status,
      responseTime,
      statusCode,
      error,
    },
  });

  const level =
    status === "UP"
      ? "info"
      : errorKind === "dns" || errorKind === "timeout"
        ? "error"
        : "warn";
  log[level]({
    msg: "url.check.result",
    urlId: url.id,
    address: url.address,
    status,
    responseTime,
    statusCode,
    error,
  });

  const addressForEmail = urlWithData?.address ?? url.address;
  if (userEmail) {
    if (
      status === "DOWN" &&
      (previousStatus === "UP" || previousStatus === undefined)
    ) {
      sendDownAlert(userEmail, addressForEmail, error);
    } else if (status === "UP" && previousStatus === "DOWN") {
      sendRecoveryAlert(userEmail, addressForEmail);
    }
  }

  return saved;
}

/** Runs checkUrl for all URLs with Promise.allSettled; logs rejections. */
export async function runChecksForUrls(urls, correlationId) {
  if (!urls.length) {
    return [];
  }

  const settled = await Promise.allSettled(
    urls.map((u) => checkUrl(u, correlationId))
  );
  const results = [];
  const log = withCorrelationId(correlationId);

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      const reason = s.reason;
      log.error({
        msg: "url.check.rejected",
        urlId: urls[i]?.id,
        address: urls[i]?.address,
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      results.push(null);
    }
  }

  return results;
}
