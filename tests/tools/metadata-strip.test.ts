import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ErrorCode } from "@/lib/error";
import { metadataStripHandler } from "@/tools/metadata-strip";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.tmp-strip-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() =>
  import("node:fs").then((fs) =>
    fs.rmSync(TMP_DIR, { recursive: true, force: true }),
  ),
);

function parse(result: Awaited<ReturnType<typeof metadataStripHandler>>) {
  const block = result.content[0];
  if (!block || block.type !== "text") throw new Error("Expected text block");
  return JSON.parse(block.text) as Record<string, unknown>;
}

describe("metadata_strip", () => {
  test("strips EXIF from image that has EXIF data", async () => {
    const output = join(TMP_DIR, "stripped.jpg");
    const result = await metadataStripHandler({
      image_path: fixture("sample-with-exif.jpg"),
      output_path: output,
    });
    expect(result.isError).toBeUndefined();
    expect(existsSync(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test("returns had_exif: true for image with EXIF", async () => {
    const output = join(TMP_DIR, "had-exif.jpg");
    const data = parse(
      await metadataStripHandler({
        image_path: fixture("sample-with-exif.jpg"),
        output_path: output,
      }),
    );
    expect(data.had_exif).toBe(true);
  });

  test("returns had_exif: false for image without EXIF", async () => {
    const output = join(TMP_DIR, "no-exif.webp");
    const data = parse(
      await metadataStripHandler({
        image_path: fixture("sample-webp.webp"),
        output_path: output,
      }),
    );
    expect(data.had_exif).toBe(false);
  });

  test("returns input_size_bytes, output_size_bytes, stripped_bytes", async () => {
    const output = join(TMP_DIR, "sizes.jpg");
    const data = parse(
      await metadataStripHandler({
        image_path: fixture("sample-with-exif.jpg"),
        output_path: output,
      }),
    );
    expect(typeof data.input_size_bytes).toBe("number");
    expect(typeof data.output_size_bytes).toBe("number");
    expect(data.stripped_bytes).toBe(
      (data.input_size_bytes as number) - (data.output_size_bytes as number),
    );
  });

  test("works for image with no EXIF (produces valid output)", async () => {
    const output = join(TMP_DIR, "clean-in.webp");
    const result = await metadataStripHandler({
      image_path: fixture("sample-webp.webp"),
      output_path: output,
    });
    expect(result.isError).toBeUndefined();
    expect(existsSync(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.exif).toBeUndefined();
  });

  test("works for PNG input", async () => {
    const output = join(TMP_DIR, "stripped.png");
    const result = await metadataStripHandler({
      image_path: fixture("sample-alpha.png"),
      output_path: output,
    });
    expect(result.isError).toBeUndefined();
    expect(existsSync(output)).toBe(true);
  });

  test("returns FILE_NOT_FOUND for missing input", async () => {
    const result = await metadataStripHandler({
      image_path: "/no/such.jpg",
      output_path: join(TMP_DIR, "x.jpg"),
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await metadataStripHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_path: "/no/dir/out.jpg",
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.OUTPUT_NOT_WRITABLE);
  });
});
