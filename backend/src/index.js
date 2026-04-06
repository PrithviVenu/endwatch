import dotenv from "dotenv";
dotenv.config();

import "express-async-errors";
import express from "express";
import cors from "cors";

import routes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import urlRoutes from "./routes/urls.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { logger } from "./utils/logger.js";
import { processQueue } from "./services/queue.js";
import { startScheduler } from "./services/scheduler.js";

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);
app.use("/api", routes);

app.use(errorHandler);

processQueue();
startScheduler();

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
