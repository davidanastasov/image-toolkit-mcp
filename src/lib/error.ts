export const ErrorCode = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  SIZE_EXCEEDED: "SIZE_EXCEEDED",
  INVALID_INPUT: "INVALID_INPUT",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  OUTPUT_NOT_WRITABLE: "OUTPUT_NOT_WRITABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Used as a tool error return type in the MCP protocol
 */
export class ToolError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ToolError";
  }
}

/**
 * Used internally in the image processing pipeline
 */
export class ImageProcessingError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ImageProcessingError";
  }
}
