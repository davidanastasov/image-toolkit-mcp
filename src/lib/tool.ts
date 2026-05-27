import type { CallToolResult } from "@modelcontextprotocol/server";
import { ErrorCode, ToolError } from "./error";
import { logger } from "./logger";

function toolError(code: ErrorCode, message: string): CallToolResult {
  return {
    content: [
      { type: "text", text: JSON.stringify({ error: true, code, message }) },
    ],
    isError: true,
  };
}

export function handle<T = void>(
  handler: (input: T) => Promise<CallToolResult>,
): (input: T) => Promise<CallToolResult> {
  return async (input) => {
    const start = performance.now();

    try {
      const result = await handler(input);

      logger.debug(
        { duration: `${(performance.now() - start).toFixed(0)}ms` },
        "Tool completed",
      );

      return result;
    } catch (err) {
      const duration = `${(performance.now() - start).toFixed(0)}ms`;

      if (err instanceof ToolError) {
        logger.warn(
          { code: err.code, cause: err.cause, duration },
          err.message,
        );
        return toolError(err.code, err.message);
      }

      logger.error({ err, duration }, "Unexpected error in tool handler");

      return toolError(
        ErrorCode.PROCESSING_FAILED,
        err instanceof Error ? err.message : String(err),
      );
    }
  };
}
