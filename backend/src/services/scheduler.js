import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import { addCheckJob } from "./queue.js";

export function startScheduler() {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const urls = await prisma.url.findMany({
          where: { active: true },
          include: {
            checkResults: {
              take: 1,
              orderBy: { checkedAt: "desc" },
            },
          },
        });

        const now = Date.now();
        const due = urls.filter((u) => {
          const latest = u.checkResults[0];
          const intervalMs = u.intervalMin * 60 * 1000;
          if (!latest) return true;
          const elapsedMs = now - new Date(latest.checkedAt).getTime();
          return elapsedMs >= intervalMs;
        });

        logger.info({
          msg: "scheduler tick",
          dueCount: due.length,
          totalActive: urls.length,
        });

        if (due.length === 0) return;

        const payload = due.map((u) => ({
          id: u.id,
          address: u.address,
          label: u.label,
          userId: u.userId,
          intervalMin: u.intervalMin,
          active: u.active,
          createdAt: u.createdAt,
        }));
        await addCheckJob(payload);
      } catch (err) {
        logger.error({
          msg: "scheduler tick failed",
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }
  );
}
