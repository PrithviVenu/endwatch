import axios from "axios";
import { prisma } from "../lib/prisma.js";
import { withCorrelationId } from "../utils/logger.js";

/** GET health check for a URL row; persists a CheckResult and returns it. */
export async function checkUrl(url, correlationId) {
  const start = Date.now();
  let responseTime = null;
  let statusCode = null;
  let error = null;
  let status = "DOWN";
  let errorKind = null;

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
    }
  } catch (err) {
    responseTime = Date.now() - start;
    const code = err?.code;
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
        err instanceof Error ? err.message : err != null ? String(err) : "Unknown error";
      errorKind = "unknown";
    }
    if (axios.isAxiosError(err) && err.response != null) {
      statusCode = err.response.status;
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

  const log = withCorrelationId(correlationId);
  const level =
    status === "UP"
      ? "info"
      : errorKind === "timeout" || errorKind === "dns"
        ? "error"
        : "warn";

  log[level]({
    msg: "url.check",
    urlId: url.id,
    address: url.address,
    status,
    responseTime,
    statusCode,
    error,
  });

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
