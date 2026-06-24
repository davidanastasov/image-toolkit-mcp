import { createHash } from "node:crypto";
import { copyFileSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  assertOutputDirExists,
  assertOutputFileNotExists,
  resolveOutputPath,
  resolvePath,
} from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.input<typeof imageHashToolInputSchema>;
const imageHashToolInputSchema = z.object({
  image_path: z
    .string()
    .describe("Absolute or relative path to the image file"),
  output_dir: z
    .string()
    .optional()
    .describe(
      "Optional output directory. If omitted, saves next to the source image.",
    ),
});

type OutputSchema = z.infer<typeof imageHashToolOutputSchema>;
const imageHashToolOutputSchema = z.object({
  input_path: z.string().describe("Resolved absolute path to the source image"),
  output_path: z.string().describe("Absolute path to the cache-busting copy"),
  hash: z.string().describe("The full SHA-256 hash of the image file"),
});

export function registerImageHashTool(server: McpServer) {
  server.registerTool(
    "image_hash",
    {
      title: "Append File Hash to Image for Cache-Busting",
      description:
        "Creates a copy of an image file whose filename includes the last 6 characters of a SHA-256 hash for cache busting. If an output directory is omitted, the copy is written next to the source image.",
      annotations: { readOnlyHint: false },
      inputSchema: imageHashToolInputSchema,
      outputSchema: imageHashToolOutputSchema,
    },
    imageHashHandler satisfies ToolHandler<InputSchema>,
  );
}

function stripHashSuffix(name: string): string {
  return name.replace(/-[0-9a-f]{6}$/, "");
}

export const imageHashHandler = handle<InputSchema, OutputSchema>(
  async ({ image_path, output_dir }) => {
    const resolvedInput = resolvePath(image_path);
    const hash = createHash("sha256")
      .update(readFileSync(resolvedInput))
      .digest("hex");

    const ext = extname(resolvedInput);
    const rawName = basename(resolvedInput, ext);
    const cleanName = stripHashSuffix(rawName);

    const resolvedOutputDir = output_dir
      ? resolveOutputPath(output_dir)
      : dirname(resolvedInput);
    const resolvedOutput = join(
      resolvedOutputDir,
      `${cleanName}-${hash.slice(-6)}${ext}`,
    );

    assertOutputDirExists(resolvedOutputDir);
    assertOutputFileNotExists(resolvedOutput);

    copyFileSync(resolvedInput, resolvedOutput);

    const result: OutputSchema = {
      input_path: resolvedInput,
      output_path: resolvedOutput,
      hash: hash,
    };

    return {
      content: [],
      structuredContent: result,
    };
  },
);
