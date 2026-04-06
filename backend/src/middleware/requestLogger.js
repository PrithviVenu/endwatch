import { v4 as uuidv4 } from "uuid";
import { withCorrelationId } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  req.correlationId = uuidv4();
  const start = Date.now();
  const path = req.originalUrl || req.url;
  const log = withCorrelationId(req.correlationId);

  log.info({
    msg: "request.start",
    method: req.method,
    path,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    log.info({
      msg: "request.finish",
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id,
    });
  });

  next();
}
