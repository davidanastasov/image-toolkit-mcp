import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { basename, join } from "node:path";
import { ErrorCode } from "@/lib/error";
import { imageHashHandler } from "@/tools/image-hash";
import { assertErrorBlock } from "../helpers";
import { fixture } from "../helpers/fixtures";

const TMP_DIR = join(import.meta.dir, "../../.test-output/hash-test");

beforeAll(() => mkdirSync(TMP_DIR, { recursive: true }));
afterAll(() => rmSync(TMP_DIR, { recursive: true, force: true }));

async function hash(imagePath: string, outputDir?: string) {
  const result = await imageHashHandler({
    image_path: fixture(imagePath),
    output_dir: outputDir,
  });

  expect(result.isError).toBeUndefined();
  assert(result.structuredContent !== undefined);
  return result.structuredContent;
}

describe("image_hash", () => {
  test("creates a hashed output file with a 6-character sha256 suffix", async () => {
    const data = await hash("sample-rgb.jpg", TMP_DIR);

    expect(existsSync(data.output_path)).toBe(true);
    expect(data.output_path).toContain("-");
    expect(data.output_path.endsWith(".jpg")).toBe(true);
    expect(typeof data.hash).toBe("string");
    expect(data.hash).toBe(
      "6c6ff81604dccfab8375b86fb86c8dadfd75323811335e5896d4c4372d63df7f",
    );
    unlinkSync(data.output_path);
  });

  test("hash is correct", async () => {
    const data = await hash("sample-rgb.jpg", TMP_DIR);
    expect(data.hash).toBe(
      "6c6ff81604dccfab8375b86fb86c8dadfd75323811335e5896d4c4372d63df7f",
    );
    unlinkSync(data.output_path);
  });

  test("hash is deterministic across calls", async () => {
    const a = await hash("sample-rgb.jpg", TMP_DIR);
    unlinkSync(a.output_path);
    const b = await hash("sample-rgb.jpg", TMP_DIR);
    expect(a.hash).toBe(b.hash);
    unlinkSync(b.output_path);
  });

  test("different files produce different hashes", async () => {
    const a = await hash("sample-rgb.jpg", TMP_DIR);
    const b = await hash("sample-webp.webp", TMP_DIR);
    expect(a.hash).not.toBe(b.hash);
    unlinkSync(a.output_path);
    unlinkSync(b.output_path);
  });

  test("returns input_path and output_path", async () => {
    const data = await hash("sample-rgb.jpg", TMP_DIR);
    expect(data.input_path.startsWith("/")).toBe(true);
    expect(data.output_path.startsWith(TMP_DIR)).toBe(true);
    expect(data.output_path).toMatch(/-[0-9a-f]{6}\.jpg$/);
    unlinkSync(data.output_path);
  });

  test("already-hashed file does not accumulate a double suffix", async () => {
    const first = await hash("sample-rgb.jpg", TMP_DIR);
    const second = await imageHashHandler({
      image_path: first.output_path,
      output_dir: TMP_DIR,
    });

    expect(second.isError).toBe(true);
    assertErrorBlock(second.content[0], ErrorCode.OUTPUT_FILE_EXISTS);

    unlinkSync(first.output_path);
  });

  test("non-hash 6-char suffix is preserved, not stripped", async () => {
    const srcPath = join(TMP_DIR, "sample-rgb-thumb1.jpg");
    copyFileSync(fixture("sample-rgb.jpg"), srcPath);

    const result = await imageHashHandler({
      image_path: srcPath,
      output_dir: TMP_DIR,
    });

    expect(result.isError).toBeUndefined();
    assert(result.structuredContent !== undefined);

    const outBase = basename(result.structuredContent.output_path, ".jpg");
    expect(outBase).toMatch(/^sample-rgb-thumb1-[0-9a-f]{6}$/);

    unlinkSync(srcPath);
    unlinkSync(result.structuredContent.output_path);
  });

  test("returns FILE_NOT_FOUND for missing file", async () => {
    const result = await imageHashHandler({
      image_path: "/no/such/file.jpg",
      output_dir: TMP_DIR,
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });

  test("returns OUTPUT_NOT_WRITABLE for non-existent output directory", async () => {
    const result = await imageHashHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: "/no/such/dir",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_NOT_WRITABLE);
  });

  test("returns OUTPUT_FILE_EXISTS when hashed file already exists", async () => {
    const firstResult = await imageHashHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
    });

    expect(firstResult.isError).toBeUndefined();
    assert(firstResult.structuredContent !== undefined);

    const result = await imageHashHandler({
      image_path: fixture("sample-rgb.jpg"),
      output_dir: TMP_DIR,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    assertErrorBlock(result.content[0], ErrorCode.OUTPUT_FILE_EXISTS);
    unlinkSync(firstResult.structuredContent.output_path);
  });
});
