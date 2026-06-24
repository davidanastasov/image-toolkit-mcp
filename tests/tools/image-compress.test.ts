import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { imageCompressHandler } from "@/tools/image-compress";
import { assertErrorBlock } from "../helpers";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.test-output/compress-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

async function compress(
  fixtureName: string,
  outputName: string,
  quality: number,
) {
  const result = await imageCompressHandler({
    image_path: fixture(fixtureName),
    output_path: join(TMP_DIR, outputName),
    quality,
  });

  expect(result.isError).toBeUndefined();
  assert(result.structuredContent !== undefined);
  return result.structuredContent;
}

describe("image_compress", () => {
  test("creates output file and returns size comparison", async () => {
    const data = await compress("sample-rgb.jpg", "out.jpg", 80);
    expect(existsSync(join(TMP_DIR, "out.jpg"))).toBe(true);
    expect(typeof data.input_size_bytes).toBe("number");
    expect(typeof data.output_size_bytes).toBe("number");
    expect(typeof data.savings_bytes).toBe("number");
    expect(typeof data.savings_percent).toBe("number");
  });

  test("returns the quality that was applied", async () => {
    const data = await compress("sample-rgb.jpg", "quality-check.jpg", 60);
    expect(data.quality).toBe(60);
  });

  test("forces source extension regardless of output_path extension", async () => {
    const data = await compress("sample-rgb.jpg", "forced-ext.png", 80);
    expect(data.output_path.endsWith(".jpg")).toBe(true);
  });

  test("lower quality produces smaller JPEG", async () => {
    await compress("sample-rgb.jpg", "quality-80.jpg", 80);
    await compress("sample-rgb.jpg", "quality-1.jpg", 1);

    const size80 = statSync(join(TMP_DIR, "quality-80.jpg")).size;
    const size1 = statSync(join(TMP_DIR, "quality-1.jpg")).size;
    expect(size1).toBeLessThan(size80);
  });

  test("works for WebP input", async () => {
    await compress("sample-webp.webp", "out.webp", 50);
    expect(existsSync(join(TMP_DIR, "out.webp"))).toBe(true);
  });

  test("works for PNG input", async () => {
    await compress("sample-alpha.png", "out.png", 80);
    expect(existsSync(join(TMP_DIR, "out.png"))).toBe(true);
  });

  test("compresses PNG with palette at quality below 100", async () => {
    const data = await compress("sample-alpha.png", "palette.png", 60);
    expect(data.output_size_bytes).toBeLessThan(data.input_size_bytes);
  });

  test("returns savings_bytes as input minus output", async () => {
    const data = await compress("sample-rgb.jpg", "savings.jpg", 80);
    expect(data.savings_bytes).toBe(
      data.input_size_bytes - data.output_size_bytes,
    );
  });

  test("returns OUTPUT_FILE_EXISTS when output already exists", async () => {
    await compress("sample-rgb.jpg", "overwrite.jpg", 80);

    const result = await imageCompressHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: join(TMP_DIR, "overwrite.jpg"),
      quality: 80,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_FILE_EXISTS);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await imageCompressHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: "/no/such/dir/out.jpg",
      quality: 80,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_NOT_WRITABLE);
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await imageCompressHandler({
      image_path: "/no/such.jpg",
      output_path: join(TMP_DIR, "x.jpg"),
      quality: 80,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });
});
