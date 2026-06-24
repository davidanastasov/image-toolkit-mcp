import { type Stats, statSync } from "node:fs";

/** Returns `fs.Stats` for the given path, or `null` if the path does not exist or cannot be read. */
export function statSafe(p: string): Stats | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
