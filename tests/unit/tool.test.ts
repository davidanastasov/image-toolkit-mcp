import { describe, expect, test } from "bun:test";
import { ErrorCode, ToolError } from "@/lib/error";
import { handle } from "@/lib/tool";

describe("handle", () => {
  test("returns the handler result on success", async () => {
    const wrapped = handle(async () => ({
      content: [{ type: "text", text: "ok" }],
    }));

    const result = await wrapped();
    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({ type: "text", text: "ok" });
  });

  test("catches ToolError", async () => {
    const wrapped = handle(async () => {
      throw new ToolError(ErrorCode.FILE_NOT_FOUND, "file missing");
    });

    const result = await wrapped();
    expect(result.isError).toBe(true);

    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(body.message).toBe("file missing");
  });

  test("catches unexpected errors and returns PROCESSING_FAILED", async () => {
    const wrapped = handle(async () => {
      throw new Error("something exploded");
    });

    const result = await wrapped();
    expect(result.isError).toBe(true);

    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.PROCESSING_FAILED);
    expect(body.message).toBe("something exploded");
  });

  test("catches non-Error throws and coerces to string", async () => {
    const wrapped = handle(async () => {
      throw "raw string throw";
    });

    const result = await wrapped();
    expect(result.isError).toBe(true);

    const body = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(body.code).toBe(ErrorCode.PROCESSING_FAILED);
    expect(body.message).toBe("raw string throw");
  });

  test("passes input through to the handler", async () => {
    const wrapped = handle(async (input: { value: number }) => ({
      content: [{ type: "text", text: String(input.value) }],
    }));

    const result = await wrapped({ value: 42 });
    expect(result.content[0]).toEqual({ type: "text", text: "42" });
  });
});
