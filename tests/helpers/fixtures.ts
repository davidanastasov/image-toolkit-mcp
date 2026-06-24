import { existsSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

export function fixture(fixture: string): string {
  const path = join(FIXTURES_DIR, fixture);

  if (!existsSync(path)) {
    throw new Error(
      `Test fixture not found: ${path}\nRun: bun scripts/generate-fixtures.ts`,
    );
  }

  return path;
}
