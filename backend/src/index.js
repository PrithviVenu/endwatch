import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
