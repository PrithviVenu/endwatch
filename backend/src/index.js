import dotenv from "dotenv";
dotenv.config();

import "express-async-errors";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import routes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import urlRoutes from "./routes/urls.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { logger } from "./utils/logger.js";
import { processQueue } from "./services/queue.js";
import { startScheduler } from "./services/scheduler.js";

const app = express();
app.set('trust proxy', 1)
const port = Number(process.env.PORT) || 5001;

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  handler: (req, res, _next, _options) => {
    logger.warn({
      msg: "rate_limit.hit",
      scope: "global",
      ip: req.ip,
      path: req.originalUrl || req.url,
    });
    res
      .status(429)
      .json({ error: "Too many requests, please try again later" });
  },
});

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
  handler: (req, res, _next, _options) => {
    logger.warn({
      msg: "rate_limit.hit",
      scope: "auth",
      ip: req.ip,
      path: req.originalUrl || req.url,
    });
    res
      .status(429)
      .json({ error: "Too many login attempts, please try again later" });
  },
});

app.use(cors());
app.use(express.json());
app.use(globalLimiter);
app.use(requestLogger);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/urls", urlRoutes);
app.use("/api", routes);

app.use(errorHandler);

processQueue();
startScheduler();

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
