import { describe, expect, test } from "bun:test";
import assert from "node:assert";
import { ErrorCode } from "@/lib/error";
import { metadataReadToolHandler } from "@/tools/metadata-read";
import { assertErrorBlock, fixture } from "../helpers";

export async function readMetadata(fixtureName: string) {
  const result = await metadataReadToolHandler({
    image_path: fixture(fixtureName),
  });

  expect(result.isError).toBeUndefined();
  assert(result.structuredContent !== undefined);
  return result.structuredContent;
}

describe("metadata_read — basic metadata", () => {
  test("reads dimensions, format, and aspect ratio from a JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");

    expect(data.format).toBe("jpeg");
    expect(data.width).toBe(100);
    expect(data.height).toBe(75);
    expect(data.aspect_ratio).toBe("4:3");
  });

  test("returns file_size_bytes", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.file_size_bytes > 0).toBe(true);
  });

  test("returns absolute file_path", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.file_path.startsWith("/")).toBe(true);
  });
});

describe("metadata_read — format-specific fields", () => {
  test("returns correct dpi when available", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.dpi).toBe(72);
  });

  test("returns dpi: null for WebP image", async () => {
    const data = await readMetadata("sample-webp.webp");
    expect(data.dpi).toBeNull();
  });

  test("returns has_alpha: false for RGB JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.has_alpha).toBe(false);
  });

  test("returns has_alpha: true for RGBA PNG", async () => {
    const data = await readMetadata("sample-alpha.png");
    expect(data.has_alpha).toBe(true);
  });

  test("returns is_progressive: false for baseline JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.is_progressive).toBe(false);
  });

  test("returns is_progressive: true for progressive JPEG", async () => {
    const data = await readMetadata("sample-progressive.jpg");
    expect(data.is_progressive).toBe(true);
  });

  test("returns chroma_subsampling for JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.chroma_subsampling).toMatch(/^4:/);
  });

  test("returns chroma_subsampling: null for PNG", async () => {
    const data = await readMetadata("sample-alpha.png");
    expect(data.chroma_subsampling).toBeNull();
  });

  test("returns is_animated: false and frame_count: 1 for static image", async () => {
    const data = await readMetadata("sample-rgb.jpg");

    expect(data.is_animated).toBe(false);
    expect(data.frame_count).toBe(1);
  });

  test("returns bit_depth: 8 for a standard JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.bit_depth).toBe(8);
  });

  test("returns orientation: 1 when no EXIF orientation is set", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.orientation).toBe(1);
  });

  test("returns WebP format correctly", async () => {
    const data = await readMetadata("sample-webp.webp");
    expect(data.format).toBe("webp");
    expect(data.chroma_subsampling).toBeNull();
  });
});

describe("metadata_read — EXIF", () => {
  test("returns has_exif: false and exif: null for image without EXIF", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.has_exif).toBe(false);
    expect(data.exif).toBeNull();
  });

  test("returns EXIF fields for image with EXIF data", async () => {
    const data = await readMetadata("sample-with-exif.jpg");

    expect(data.has_exif).toBe(true);
    assert(data.exif !== null);
    expect(data.exif.make).toBe("Canon");
    expect(data.exif.model).toBe("Canon EOS 40D");
  });

  test("decodes GPS to decimal degrees", async () => {
    const data = await readMetadata("sample-with-exif.jpg");

    assert(data.exif !== null);
    expect(data.exif.gps_lat).toBeCloseTo(43.47, 1);
    expect(data.exif.gps_lng).toBeCloseTo(11.89, 1);
  });

  test("formats ExposureTime as a fraction string", async () => {
    const data = await readMetadata("sample-with-exif.jpg");

    assert(data.exif !== null);
    expect(typeof data.exif.exposure_time).toBe("string");
    expect(data.exif.exposure_time).toMatch(/^1\//);
  });

  test("returns date_taken as an ISO string", async () => {
    const data = await readMetadata("sample-with-exif.jpg");

    assert(data.exif !== null);
    expect(data.exif.date_taken).toMatch("2008-05-30T15:56:01.000Z");
  });

  test("returns ISO as a number", async () => {
    const data = await readMetadata("sample-with-exif.jpg");

    assert(data.exif !== null);
    expect(typeof data.exif.iso).toBe("number");
    expect(data.exif.iso).toBe(100);
  });
});

describe("metadata_read — warnings", () => {
  test("returns empty warnings array for clean sRGB JPEG", async () => {
    const data = await readMetadata("sample-rgb.jpg");
    expect(data.warnings).toEqual([]);
  });

  test("returns CMYK warning for CMYK image", async () => {
    const data = await readMetadata("sample-cmyk.jpg");

    const warnings = data.warnings;
    expect(warnings.some((w) => w.toLowerCase().includes("cmyk"))).toBe(true);
  });
});

describe("metadata_read — error handling", () => {
  test("returns isError with FILE_NOT_FOUND for a missing file", async () => {
    const result = await metadataReadToolHandler({
      image_path: "missing_file.jpg",
    });

    expect(result.isError).toBe(true);
    assert(result.structuredContent === undefined);
    assertErrorBlock(result.content[0], ErrorCode.FILE_NOT_FOUND);
  });

  test("returns isError with UNSUPPORTED_FORMAT for a non-image file", async () => {
    const result = await metadataReadToolHandler({
      image_path: fixture("sample-text.txt"),
    });

    expect(result.isError).toBe(true);
    assertErrorBlock(result.content[0], ErrorCode.UNSUPPORTED_FORMAT);
  });
});
