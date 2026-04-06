import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const payload = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
    redis: "disconnected",
    database: "disconnected",
  };

  try {
    const redis = getRedis();
    await redis.connect();
    await redis.ping();
    payload.redis = "connected";
  } catch {
    payload.redis = "disconnected";
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    payload.database = "connected";
  } catch {
    payload.database = "disconnected";
  }

  res.json(payload);
});

export default router;
