import { afterAll, describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { ErrorCode, ImageProcessingError } from "@/lib/error";
import { resolvePath } from "@/lib/paths";

const existsSyncMock = mock(() => true);
const statSyncMock = mock(() => ({ isFile: () => true as boolean }));

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
    statSyncMock.mockReturnValue({ isFile: () => false });

    try {
      resolvePath("/dir");
    } catch (err) {
      expect(err).toBeInstanceOf(ImageProcessingError);
      expect((err as ImageProcessingError).code).toBe(ErrorCode.FILE_NOT_FOUND);
    }
  });
});
