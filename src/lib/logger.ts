import winston from "winston";
import env from "@/utils/env";

const { combine, timestamp, colorize, printf } = winston.format;

const format = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? "\n" + JSON.stringify(meta, null, 2) : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: format,
  transports: [new winston.transports.Console()],
});

export default logger;
