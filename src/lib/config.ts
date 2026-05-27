import { z } from "zod";

export const envSchema = z.object({
  IMAGE_TOOLKIT_LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export const env = envSchema.parse(process.env);
