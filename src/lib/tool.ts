import type {
  CallToolResult,
  ContentBlock,
  ServerContext,
} from "@modelcontextprotocol/server";
import { ErrorCode, ImageProcessingError, ToolError } from "./error";
import { logger } from "./logger";

function toolError(
  code: ErrorCode,
  message: string,
): CustomCallToolResult<never> {
  return {
    content: [
      { type: "text", text: JSON.stringify({ error: true, code, message }) },
    ],
    isError: true,
  };
}

type CustomCallToolResult<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  content: ContentBlock[];
  structuredContent?: T;
  isError?: boolean;
  _meta?: Record<string, unknown>;
};

export function handle<
  TInput = void,
  TOutput extends Record<string, unknown> = Record<string, unknown>,
>(
  handler: (input: TInput) => Promise<CustomCallToolResult<TOutput>>,
): (input: TInput) => Promise<CustomCallToolResult<TOutput>> {
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

      if (err instanceof ToolError || err instanceof ImageProcessingError) {
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

export type ToolHandler<TInput = object> = (
  args: TInput,
  ctx: ServerContext,
) => Promise<CallToolResult>;
