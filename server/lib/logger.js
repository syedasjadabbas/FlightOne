import winston from "winston";

const { combine, timestamp, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level}] ${message}${rest}`;
});

const logger = winston.createLogger({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format:
    process.env.NODE_ENV === "production"
      ? combine(timestamp({ format: "ISO8601" }), json())
      : combine(timestamp({ format: "ISO8601" }), colorize(), devFormat),
  transports: [new winston.transports.Console()],
});

export default logger;
