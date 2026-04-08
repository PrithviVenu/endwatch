import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { runChecksForUrls } from "../services/monitor.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.use(authenticate);

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
const MAX_REQUEST_BODY_BYTES = 128 * 1024; // 128kb
const MAX_HEADERS_BYTES = 32 * 1024; // 32kb

function normalizeUrlAddress(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function parseHeaders(raw) {
  if (raw === undefined || raw === null) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("body.headers must be an object of string:string pairs");
  }

  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.trim() === "") {
      throw new Error("body.headers keys must be non-empty strings");
    }
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") {
      throw new Error("body.headers values must be strings");
    }
    out[k] = v;
  }

  return out;
}

function parseUrlPayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("body must be an object");
  }

  const address = normalizeUrlAddress(body.address);
  if (address === null) {
    throw new Error("body.address must be a non-empty string");
  }

  const label =
    body.label === undefined || body.label === null ? undefined : String(body.label);

  let intervalMin = undefined;
  if (body.intervalMin !== undefined && body.intervalMin !== null) {
    const n = Number(body.intervalMin);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error("body.intervalMin must be a number >= 1");
    }
    intervalMin = Math.floor(n);
  }

  const methodRaw =
    body.method === undefined || body.method === null ? "GET" : String(body.method);
  const method = methodRaw.toUpperCase();
  if (!HTTP_METHODS.has(method)) {
    throw new Error("body.method must be a valid HTTP method");
  }

  const headers = parseHeaders(body.headers);
  const headersBytes = Buffer.byteLength(JSON.stringify(headers), "utf8");
  if (headersBytes > MAX_HEADERS_BYTES) {
    const err = new Error("headers too large");
    err.statusCode = 413;
    throw err;
  }

  const requestBody =
    body.requestBody === undefined || body.requestBody === null
      ? null
      : String(body.requestBody);

  if (BODYLESS_METHODS.has(method) && requestBody && requestBody.trim() !== "") {
    const err = new Error("requestBody is not allowed for GET/HEAD requests");
    err.statusCode = 400;
    throw err;
  }

  if (requestBody !== null) {
    const bytes = Buffer.byteLength(requestBody, "utf8");
    if (bytes > MAX_REQUEST_BODY_BYTES) {
      const err = new Error("requestBody too large");
      err.statusCode = 413;
      throw err;
    }
  }

  return { address, label, intervalMin, method, headers, requestBody };
}

router.get("/", async (req, res) => {
  const rows = await prisma.url.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      checkResults: {
        take: 1,
        orderBy: { checkedAt: "desc" },
      },
    },
  });

  const urls = rows.map(({ checkResults, ...url }) => ({
    ...url,
    latestCheck: checkResults[0] ?? null,
  }));

  res.json({ urls });
});

router.post("/", async (req, res) => {
  try {
    const { address, label, intervalMin, method, headers, requestBody } =
      parseUrlPayload(req.body ?? {});

    const userId = req.user.id;

    const row = await prisma.url.upsert({
      where: { userId_address: { userId, address } },
      create: {
        userId,
        address,
        label: label ?? null,
        intervalMin: intervalMin ?? 5,
        method,
        headers,
        requestBody,
      },
      update: {
        ...(label !== undefined ? { label } : {}),
        ...(intervalMin !== undefined ? { intervalMin } : {}),
        method,
        headers,
        requestBody,
      },
      include: {
        checkResults: {
          take: 1,
          orderBy: { checkedAt: "desc" },
        },
      },
    });

    const { checkResults, ...url } = row;
    return res.status(201).json({
      url: {
        ...url,
        latestCheck: checkResults[0] ?? null,
      },
    });
  } catch (e) {
    const statusCode =
      e && typeof e === "object" && "statusCode" in e ? Number(e.statusCode) : 400;
    if (e instanceof Error) {
      return res.status(statusCode).json({ error: e.message });
    }
    return res.status(statusCode).json({ error: "Invalid request" });
  }
});

router.post("/check", async (req, res) => {
  const urls = await prisma.url.findMany({
    where: { userId: req.user.id },
  });

  runChecksForUrls(urls, req.correlationId).catch((err) => {
    logger.error(err);
  });

  res.json({ message: `Check triggered for ${urls.length} URLs` });
});

router.get("/stats", async (req, res) => {
  const userId = req.user.id;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const urlRows = await prisma.url.findMany({
    where: { userId },
    include: {
      checkResults: {
        take: 1,
        orderBy: { checkedAt: "desc" },
      },
    },
  });

  const total = urlRows.length;
  let up = 0;
  let down = 0;
  for (const u of urlRows) {
    const latest = u.checkResults[0];
    if (!latest) continue;
    if (latest.status === "UP") up += 1;
    else if (latest.status === "DOWN") down += 1;
  }

  const results24h = await prisma.checkResult.findMany({
    where: {
      checkedAt: { gte: since },
      url: { userId },
    },
    select: { status: true, responseTime: true },
  });

  const n24 = results24h.length;
  const up24 = results24h.filter((r) => r.status === "UP").length;
  const uptimePct =
    n24 === 0 ? null : Math.round((up24 / n24) * 10000) / 100;

  const withRt = results24h.filter(
    (r) => r.responseTime !== null && r.responseTime !== undefined
  );
  const avgResponseTime =
    withRt.length === 0
      ? null
      : Math.round(
          withRt.reduce((acc, r) => acc + r.responseTime, 0) / withRt.length
        );

  res.json({
    total,
    up,
    down,
    uptimePct,
    avgResponseTime,
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.url.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!existing) {
    return res.status(404).json({ error: "URL not found" });
  }

  await prisma.url.delete({ where: { id } });
  res.status(204).send();
});

router.get("/:id/sla", async (req, res) => {
  const { id } = req.params;

  const url = await prisma.url.findFirst({
    where: { id, userId: req.user.id },
    select: { id: true },
  });

  if (!url) {
    return res.status(404).json({ error: "URL not found" });
  }

  async function calc(periodMs) {
    const since = new Date(Date.now() - periodMs);

    const [totalChecks, failures, avg] = await Promise.all([
      prisma.checkResult.count({
        where: { urlId: id, checkedAt: { gte: since } },
      }),
      prisma.checkResult.count({
        where: { urlId: id, checkedAt: { gte: since }, status: "DOWN" },
      }),
      prisma.checkResult.aggregate({
        where: { urlId: id, checkedAt: { gte: since } },
        _avg: { responseTime: true },
      }),
    ]);

    const uptimePct =
      totalChecks === 0
        ? null
        : Math.round(((totalChecks - failures) / totalChecks) * 10000) / 100;

    const avgResponseTime =
      avg?._avg?.responseTime == null ? null : Math.round(avg._avg.responseTime);

    return { uptimePct, totalChecks, failures, avgResponseTime };
  }

  const [p24h, p7d, p30d] = await Promise.all([
    calc(24 * 60 * 60 * 1000),
    calc(7 * 24 * 60 * 60 * 1000),
    calc(30 * 24 * 60 * 60 * 1000),
  ]);

  res.json({
    "24h": p24h,
    "7d": p7d,
    "30d": p30d,
  });
});

router.get("/:id/history", async (req, res) => {
  const { id } = req.params;
  const rawHours = req.query.hours;
  let hours = 24;
  if (rawHours !== undefined && rawHours !== null && rawHours !== "") {
    const n = Number(rawHours);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }
    hours = n;
  }

  const url = await prisma.url.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!url) {
    return res.status(404).json({ error: "URL not found" });
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const results = await prisma.checkResult.findMany({
    where: {
      urlId: id,
      checkedAt: { gte: since },
    },
    orderBy: { checkedAt: "asc" },
    take: 500,
  });

  res.json({ results });
});

export default router;
