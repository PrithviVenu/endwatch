import winston from "winston";

const isProd = process.env.NODE_ENV === "production";

function formatDevMessage(message, stack) {
  if (stack) return stack;
  if (message == null || message === "") return "";
  if (typeof message === "string") return message;
  if (typeof message === "number" || typeof message === "boolean") {
    return String(message);
  }
  if (message instanceof Error) return message.message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

const devFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...rest } = info;
    const main = formatDevMessage(message, stack);
    const extra =
      Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    return `${timestamp} [${level}]: ${main}${extra}`;
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
