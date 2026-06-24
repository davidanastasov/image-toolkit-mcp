import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { imageResizeHandler } from "@/tools/image-resize";
import { assertErrorBlock } from "../helpers";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.test-output/resize-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

async function resize(
  fixtureName: string,
  outputName: string,
  options: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    position?: string;
  } = {},
) {
  const result = await imageResizeHandler({
    image_path: fixture(fixtureName),
    output_path: join(TMP_DIR, outputName),
    ...options,
  });

  expect(result.isError).toBeUndefined();
  assert(result.structuredContent !== undefined);
  return result.structuredContent;
}

describe("image_resize", () => {
  test("resizes by width only, height scales proportionally", async () => {
    const data = await resize("sample-rgb.jpg", "by-width.jpg", { width: 50 });

    expect(existsSync(join(TMP_DIR, "by-width.jpg"))).toBe(true);
    expect(data.input_width).toBe(100);
    expect(data.input_height).toBe(75);
    expect(data.output_width).toBe(50);
  });

  test("resizes by height only, width scales proportionally", async () => {
    const data = await resize("sample-rgb.jpg", "by-height.jpg", {
      height: 37,
    });
    expect(data.output_height).toBe(37);
  });

  test("fit inside (default) with both dimensions constrains without cropping", async () => {
    const data = await resize("sample-rgb.jpg", "inside.jpg", {
      width: 50,
      height: 50,
    });
    // 100×75 scaled to fit in 50×50: width-limited → 50×37
    expect(data.output_width).toBeLessThanOrEqual(50);
    expect(data.output_height).toBeLessThanOrEqual(50);
  });

  test("fit cover produces exact target dimensions (crops)", async () => {
    const data = await resize("sample-rgb.jpg", "cover.jpg", {
      width: 50,
      height: 50,
      fit: "cover",
    });
    expect(data.output_width).toBe(50);
    expect(data.output_height).toBe(50);
  });

  test("returns input/output dimensions, sizes, and savings", async () => {
    const data = await resize("sample-rgb.jpg", "dims.jpg", { width: 50 });
    expect(data.input_width).toBe(100);
    expect(data.input_height).toBe(75);
    expect(typeof data.output_width).toBe("number");
    expect(typeof data.output_height).toBe("number");
    expect(typeof data.input_size_bytes).toBe("number");
    expect(typeof data.output_size_bytes).toBe("number");
    expect(typeof data.savings_bytes).toBe("number");
    expect(typeof data.savings_percent).toBe("number");
  });

  test("returns savings_bytes as input minus output", async () => {
    const data = await resize("sample-rgb.jpg", "savings.jpg", { width: 50 });
    expect(data.savings_bytes).toBe(
      data.input_size_bytes - data.output_size_bytes,
    );
  });

  test("returns INVALID_INPUT when neither width nor height is provided", async () => {
    const result = await imageResizeHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: join(TMP_DIR, "x.jpg"),
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.INVALID_INPUT);
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await imageResizeHandler({
      image_path: "/no/such.jpg",
      output_path: join(TMP_DIR, "x.jpg"),
      width: 50,
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });

  test("returns OUTPUT_FILE_EXISTS when output already exists", async () => {
    await resize("sample-rgb.jpg", "overwrite.jpg", { width: 50 });

    const result = await imageResizeHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: join(TMP_DIR, "overwrite.jpg"),
      width: 50,
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_FILE_EXISTS);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await imageResizeHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: "/no/dir/out.jpg",
      width: 50,
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_NOT_WRITABLE);
  });
});
