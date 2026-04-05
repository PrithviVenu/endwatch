import winston from "winston";

const isProd = process.env.NODE_ENV === "production";

const devFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...rest } = info;
    const extra =
      Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    return `${timestamp} [${level}]: ${stack || message || ""}${extra}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
