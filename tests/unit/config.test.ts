import { describe, expect, test } from "bun:test";
import { envSchema } from "@/lib/config";

describe("environment config", () => {
  describe("IMAGE_TOOLKIT_LOG_LEVEL", () => {
    test("defaults to info", () => {
      expect(envSchema.parse({}).IMAGE_TOOLKIT_LOG_LEVEL).toBe("info");
    });

    test("accepts all valid pino log levels", () => {
      const expectedLogLevels = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "silent",
      ] as const;

      for (const level of expectedLogLevels) {
        const parsed = envSchema.parse({ IMAGE_TOOLKIT_LOG_LEVEL: level });
        expect(parsed.IMAGE_TOOLKIT_LOG_LEVEL).toBe(level);
      }
    });

    test("rejects invalid values", () => {
      expect(() =>
        envSchema.parse({ IMAGE_TOOLKIT_LOG_LEVEL: "verbose" }),
      ).toThrow();
    });
  });
});
