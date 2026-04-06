import Redis from "ioredis";

let redis = null;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    redis = new Redis(url, { lazyConnect: true });
  }
  return redis;
}

