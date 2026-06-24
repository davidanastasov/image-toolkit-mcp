import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
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

export function resolveOutputFilePath(
  inputPath: string,
  outputPath?: string,
  ext: string = extname(inputPath),
): string {
  const inputFileName = basename(inputPath, extname(inputPath));

  // If no output path is provided, return a file in the same directory as the input.
  if (!outputPath) {
    return join(dirname(inputPath), `${inputFileName}${ext}`);
  }

  const resolved = resolveOutputPath(outputPath);

  // If the output path is a directory, return a file in that directory with the same base name as the input.
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, `${inputFileName}${ext}`);
  }

  // If the output path is a file, return it as-is.
  return join(
    dirname(resolved),
    `${basename(resolved, extname(resolved))}${ext}`,
  );
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

/** Throws OUTPUT_FILE_EXISTS if `filePath` already exists. */
export function assertOutputFileNotExists(filePath: string): void {
  if (existsSync(filePath)) {
    throw new ImageProcessingError(
      ErrorCode.OUTPUT_FILE_EXISTS,
      `Output file already exists: ${filePath}`,
    );
  }
}
