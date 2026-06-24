import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { imageConvertHandler } from "@/tools/image-convert";
import { assertErrorBlock } from "../helpers";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.test-output/convert-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

async function convert(
  fixtureName: string,
  outputName: string,
  format: "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif" | "heif",
  quality: number = 100,
) {
  const result = await imageConvertHandler({
    image_path: fixture(fixtureName),
    output_path: join(TMP_DIR, outputName),
    format,
    quality,
  });

  expect(result.isError).toBeUndefined();
  assert(result.structuredContent !== undefined);
  return result.structuredContent;
}

describe("image_convert", () => {
  test("converts JPEG to WebP", async () => {
    const data = await convert("sample-rgb.jpg", "out.webp", "webp");

    expect(existsSync(join(TMP_DIR, "out.webp"))).toBe(true);
    expect(data.input_format).toBe("jpeg");
    expect(data.output_format).toBe("webp");
  });

  test("converts JPEG to PNG", async () => {
    const data = await convert("sample-rgb.jpg", "out.png", "png");
    expect(data.output_format).toBe("png");
  });

  test("converts WebP to JPEG", async () => {
    const data = await convert("sample-webp.webp", "out.jpg", "jpeg");
    expect(data.input_format).toBe("webp");
    expect(data.output_format).toBe("jpeg");
  });

  test("returns width, height, sizes, and savings", async () => {
    const data = await convert("sample-rgb.jpg", "sized.webp", "webp");
    expect(typeof data.width).toBe("number");
    expect(typeof data.height).toBe("number");
    expect(typeof data.input_size_bytes).toBe("number");
    expect(typeof data.output_size_bytes).toBe("number");
    expect(typeof data.savings_bytes).toBe("number");
    expect(typeof data.savings_percent).toBe("number");
    expect(data.width).toBe(100);
    expect(data.height).toBe(75);
  });

  test("returns savings_bytes as input minus output", async () => {
    const data = await convert("sample-rgb.jpg", "savings.png", "png");
    expect(data.savings_bytes).toBe(
      data.input_size_bytes - data.output_size_bytes,
    );
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await imageConvertHandler({
      image_path: "/no/such.jpg",
      output_path: join(TMP_DIR, "out.webp"),
      format: "webp",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });

  test("returns OUTPUT_FILE_EXISTS when output already exists", async () => {
    await convert("sample-rgb.jpg", "overwrite.webp", "webp");

    const result = await imageConvertHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: join(TMP_DIR, "overwrite.webp"),
      format: "webp",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_FILE_EXISTS);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await imageConvertHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: "/no/such/dir/out.webp",
      format: "webp",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_NOT_WRITABLE);
  });
});
