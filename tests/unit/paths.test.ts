import { afterAll, describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { ErrorCode, ImageProcessingError } from "@/lib/error";
import { resolveOutputFilePath, resolvePath } from "@/lib/paths";

const existsSyncMock = mock(() => true);
const statSyncMock = mock(() => ({
  isFile: () => true as boolean,
  isDirectory: () => false as boolean,
}));

mock.module("node:fs", () => {
  return {
    existsSync: existsSyncMock,
    statSync: statSyncMock,
  };
});

afterAll(() => {
  mock.restore();
});

describe("resolvePath", () => {
  test("returns absolute path for existing file", () => {
    const input = "/some/file.jpg";
    const result = resolvePath(input);

    expect(result).toBe(input);
  });

  test("resolves a relative path to absolute", () => {
    const input = "some/file.jpg";
    const result = resolvePath(input);

    expect(result.length).toBeGreaterThan(input.length);
    expect(result).toEndWith("some/file.jpg");
  });

  test("expands ~/ to home directory", () => {
    const input = "~/image.jpg";
    const result = resolvePath(input);

    expect(result).toBe(`${homedir()}/image.jpg`);
  });

  test("throws FILE_NOT_FOUND when file does not exist", () => {
    existsSyncMock.mockReturnValue(false);

    try {
      resolvePath("/missing.jpg");
    } catch (err) {
      expect(err).toBeInstanceOf(ImageProcessingError);
      expect((err as ImageProcessingError).code).toBe(ErrorCode.FILE_NOT_FOUND);
    }
  });

  test("throws FILE_NOT_FOUND when path is a directory", () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    try {
      resolvePath("/dir");
    } catch (err) {
      expect(err).toBeInstanceOf(ImageProcessingError);
      expect((err as ImageProcessingError).code).toBe(ErrorCode.FILE_NOT_FOUND);
    }
  });
});

describe("resolveOutputFilePath", () => {
  test("returns file in same directory when no outputPath is provided", () => {
    const result = resolveOutputFilePath("/images/photo.jpg");
    expect(result).toBe("/images/photo.jpg");
  });

  test("replaces extension when ext is provided", () => {
    const result = resolveOutputFilePath(
      "/images/photo.jpg",
      undefined,
      ".png",
    );
    expect(result).toBe("/images/photo.png");
  });

  test("uses outputPath as a file when it does not exist as directory", () => {
    existsSyncMock.mockReturnValue(false);

    const input = "/images/photo.jpg";
    const output = "/out/result.webp";
    const result = resolveOutputFilePath(input, output, ".webp");

    expect(result).toBe("/out/result.webp");
  });

  test("treats outputPath as directory when it exists", () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    const input = "/images/photo.jpg";
    const outputDir = "/out";
    const result = resolveOutputFilePath(input, outputDir, ".png");

    expect(result).toBe("/out/photo.png");
  });

  test("uses input extension when ext is not provided", () => {
    const result = resolveOutputFilePath("/images/photo.jpg");
    expect(result).toBe("/images/photo.jpg");
  });

  test("preserves basename and input extension when outputPath is file-like", () => {
    existsSyncMock.mockReturnValue(false);

    const input = "/images/my.photo.jpg";
    const output = "/out/custom-name.png";
    const result = resolveOutputFilePath(input, output);

    expect(result).toBe("/out/custom-name.jpg");
  });

  test("handles nested output directories correctly", () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    const input = "/images/photo.jpg";
    const outputDir = "/out/images";
    const result = resolveOutputFilePath(input, outputDir, ".webp");

    expect(result).toBe("/out/images/photo.webp");
  });
});
