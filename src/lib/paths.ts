import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ErrorCode, ImageProcessingError } from "./error";

function expandHome(input: string): string {
  return input.startsWith("~/") ? `${homedir()}/${input.slice(2)}` : input;
}

/** Resolves a path (expanding `~/`) to an absolute path that points to an existing file. */
export function resolvePath(input: string): string {
  const absolute = resolve(expandHome(input));

  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new ImageProcessingError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${absolute}`,
    );
  }

  return absolute;
}

/** Resolves an output path (expanding `~/`) to an absolute path without checking existence. */
export function resolveOutputPath(input: string): string {
  return resolve(expandHome(input));
}

/** Throws OUTPUT_NOT_WRITABLE if `dir` does not exist. Pass `dirname(outputPath)` for file outputs. */
export function assertOutputDirExists(dir: string): void {
  if (!existsSync(dir)) {
    throw new ImageProcessingError(
      ErrorCode.OUTPUT_NOT_WRITABLE,
      `Output directory does not exist: ${dir}`,
    );
  }
}
