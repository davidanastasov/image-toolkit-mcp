import type { Mock } from "bun:test";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { env } from "@/lib/config";

describe("logger", () => {
  test("exposes all pino log level methods", async () => {
    const { logger } = await import("@/lib/logger");

    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  test("uses the log level from config", async () => {
    const { logger } = await import("@/lib/logger");
    expect(logger.level).toBe(env.IMAGE_TOOLKIT_LOG_LEVEL);
  });

  describe("output routing", () => {
    let stdoutSpy: Mock<typeof process.stdout.write>;

    beforeEach(() => {
      stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    test("never writes to stdout", async () => {
      const { logger } = await import("@/lib/logger");
      logger.info("test message");
      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });
});
