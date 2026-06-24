import { describe, expect, test } from "bun:test";
import { sizeSavings, statSafe } from "@/lib/file-utils";
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

describe("sizeSavings", () => {
  test("calculates correct byte savings and percentage reduction", () => {
    const result = sizeSavings(1000, 600);

    expect(result.savings_bytes).toBe(400);
    expect(result.savings_percent).toBe(40);
  });

  test("handles zero reduction (no savings)", () => {
    const result = sizeSavings(1000, 1000);

    expect(result.savings_bytes).toBe(0);
    expect(result.savings_percent).toBe(0);
  });

  test("handles case where output is larger than input (negative savings)", () => {
    const result = sizeSavings(1000, 1200);

    expect(result.savings_bytes).toBe(-200);
    expect(result.savings_percent).toBe(-20);
  });

  test("handles fractional percentage rounding to 1 decimal place", () => {
    const result = sizeSavings(3333, 1000);

    // savings = 2333, percent = 70.0% (rounded to 1 decimal place)
    expect(result.savings_bytes).toBe(2333);
    expect(result.savings_percent).toBe(70.0);
  });

  test("handles non-round percentage values correctly", () => {
    const result = sizeSavings(1000, 333);

    // 667 / 1000 = 66.7%
    expect(result.savings_bytes).toBe(667);
    expect(result.savings_percent).toBe(66.7);
  });

  test("returns 0 percent when inputBytes is 0", () => {
    const result = sizeSavings(0, 500);

    expect(result.savings_bytes).toBe(-500);
    expect(result.savings_percent).toBe(0);
  });

  test("handles both zero input and output", () => {
    const result = sizeSavings(0, 0);

    expect(result.savings_bytes).toBe(0);
    expect(result.savings_percent).toBe(0);
  });
});
