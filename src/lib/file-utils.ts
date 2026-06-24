import { type Stats, statSync } from "node:fs";

/** Returns `fs.Stats` for the given path, or `null` if the path does not exist or cannot be read. */
export function statSafe(p: string): Stats | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/** Computes byte savings and percentage reduction between two file sizes. */
export function sizeSavings(
  inputBytes: number,
  outputBytes: number,
): { savings_bytes: number; savings_percent: number } {
  const savings_bytes = inputBytes - outputBytes;
  const savings_percent =
    inputBytes > 0
      ? parseFloat(((savings_bytes / inputBytes) * 100).toFixed(1))
      : 0;

  return { savings_bytes, savings_percent };
}
