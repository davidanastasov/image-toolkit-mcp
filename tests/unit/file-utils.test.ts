import { describe, expect, test } from "bun:test";
import { statSafe } from "@/lib/file-utils";
import { fixture } from "../helpers";

describe("statSafe", () => {
  test("returns Stats for an existing file", () => {
    const stats = statSafe(fixture("sample-rgb.jpg"));
    expect(stats).not.toBeNull();
    expect(stats?.size).toBe(1009);
  });

  test("returns null for a missing file", () => {
    expect(statSafe("missing_file.jpg")).toBeNull();
  });
});
