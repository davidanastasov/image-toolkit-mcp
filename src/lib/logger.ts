import pino from "pino";
import { env } from "./config";

export const logger = pino({
  level: env.IMAGE_TOOLKIT_LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: "pino-pretty",
    options: { colorize: true, destination: 2 },
  },
});
