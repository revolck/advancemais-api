import pino from "pino";

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  base: {
    service: "advancemais-api",
    environment: process.env.NODE_ENV,
  },
});
