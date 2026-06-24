import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { imageSrcsetHandler } from "@/tools/image-srcset";
import { assertErrorBlock } from "../helpers";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.test-output/srcset-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

describe("image_srcset", () => {
  test("generates a file for each requested width", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50, 75],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    expect(result.structuredContent.files).toHaveLength(2);
    for (const f of result.structuredContent.files) {
      expect(existsSync(f.path)).toBe(true);
    }
  });

  test("default output format is webp", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    expect(result.structuredContent.format).toBe("webp");
  });

  test("files are ordered by width ascending", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [75, 50],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);

    const { files } = result.structuredContent;
    expect(files[0]?.width).toBe(50);
    expect(files[1]?.width).toBe(75);
  });

  test("returns srcset string with correct width descriptors", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50, 75],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    expect(result.structuredContent.srcset).toMatch(/50w/);
    expect(result.structuredContent.srcset).toMatch(/75w/);
  });

  test("returns html img tag containing srcset attribute", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    expect(result.structuredContent.html).toContain("<img");
    expect(result.structuredContent.html).toContain("srcset=");
    expect(result.structuredContent.html).toContain("50w");
  });

  test("each file entry has path, width, and size_bytes", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50],
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    const file = result.structuredContent.files[0];
    assert(file !== undefined);
    expect(typeof file.width).toBe("number");
    expect(typeof file.path).toBe("string");
    expect(typeof file.size_bytes).toBe("number");
  });

  test("respects explicit format: jpeg — files end with .jpg", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
      widths: [50],
      format: "jpeg",
    });
    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);
    expect(result.structuredContent.format).toBe("jpeg");
    expect(result.structuredContent.files[0]?.path).toMatch(/\.jpg$/);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await imageSrcsetHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: "/no/such/dir",
      widths: [50],
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_NOT_WRITABLE);
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await imageSrcsetHandler({
      image_path: "/no/such.jpg",
      output_dir: TMP_DIR,
      widths: [50],
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });
});
