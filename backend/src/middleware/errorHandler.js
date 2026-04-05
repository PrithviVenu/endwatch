import { logger } from "../utils/logger.js";

export function errorHandler(err, _req, res, _next) {
  logger.error(err);
  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";
  res.status(status).json({ error: message });
}
