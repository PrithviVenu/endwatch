import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  req.correlationId = uuidv4();
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const path = req.originalUrl || req.url;
    logger.info({
      msg: "request",
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      correlationId: req.correlationId,
    });
  });

  next();
}
