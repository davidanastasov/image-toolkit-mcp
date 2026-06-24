import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { FIT_OPTIONS } from "@/lib/constants";
import { ErrorCode, ToolError } from "@/lib/error";
import { sizeSavings } from "@/lib/file-utils";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  assertOutputFileNotExists,
  resolveOutputPath,
  resolvePath,
} from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.infer<typeof imageResizeToolInputSchema>;
const imageResizeToolInputSchema = z.object({
  image_path: z.string().describe("Path to the source image"),
  output_path: z.string().describe("Where to write the resized image"),
  width: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Target width in pixels"),
  height: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Target height in pixels"),
  fit: z
    .enum(FIT_OPTIONS)
    .default("inside")
    .optional()
    .describe(
      "How to fit the image into the target box: cover (crop to fill), contain (letterbox), fill (stretch), inside (scale down to fit, default), outside (scale up to cover)",
    ),
  position: z
    .string()
    .default("center")
    .optional()
    .describe(
      "Crop/anchor position for cover and contain: center (default), top, right, bottom, left, or combinations such as 'top right'",
    ),
});

type OutputSchema = z.infer<typeof imageResizeToolOutputSchema>;
const imageResizeToolOutputSchema = z.object({
  input_path: z.string().describe("Resolved absolute path to the source image"),
  output_path: z
    .string()
    .describe("Resolved absolute path to the resized image"),
  input_width: z
    .number()
    .nullable()
    .describe("Width of the source image in pixels"),
  input_height: z
    .number()
    .nullable()
    .describe("Height of the source image in pixels"),
  output_width: z
    .number()
    .nullable()
    .describe("Width of the resized image in pixels"),
  output_height: z
    .number()
    .nullable()
    .describe("Height of the resized image in pixels"),
  fit: z.enum(FIT_OPTIONS).describe("Fit mode used for resizing"),
  position: z.string().describe("Crop/anchor position used for resizing"),
  input_size_bytes: z.number().describe("Size of the source image in bytes"),
  output_size_bytes: z.number().describe("Size of the resized image in bytes"),
  savings_bytes: z
    .number()
    .describe("Number of bytes saved (input_size_bytes - output_size_bytes)"),
  savings_percent: z
    .number()
    .describe(
      "Percentage reduction in size (savings_bytes / input_size_bytes * 100)",
    ),
});

export function registerImageResizeTool(server: McpServer) {
  server.registerTool(
    "image_resize",
    {
      title: "Resize Image",
      description:
        "Resizes an image to the specified dimensions. Provide width, height, or both. When only one dimension is given, the other scales proportionally. fit='inside' (default) scales down to fit without cropping; fit='cover' fills the exact box by cropping. Call metadata_read first to know the source dimensions.",
      inputSchema: imageResizeToolInputSchema,
      outputSchema: imageResizeToolOutputSchema,
    },
    imageResizeHandler satisfies ToolHandler<InputSchema>,
  );
}

export const imageResizeHandler = handle<InputSchema, OutputSchema>(
  async ({
    image_path,
    output_path,
    width,
    height,
    fit = "inside",
    position = "center",
  }) => {
    if (!width && !height) {
      throw new ToolError(
        ErrorCode.INVALID_INPUT,
        "At least one of 'width' or 'height' must be provided",
      );
    }

    const resolved = resolvePath(image_path);
    const resolvedOut = resolveOutputPath(output_path);

    assertOutputDirExists(dirname(resolvedOut));
    assertOutputFileNotExists(resolvedOut);

    const pipeline = new ImagePipeline(resolved);
    const inputMeta = await pipeline.metadata();
    const inputSize = pipeline.getInputSize();

    const { size: outputSize, meta: outputMeta } = await pipeline
      .resize({ width, height, fit, position })
      .write(resolvedOut);

    const result: OutputSchema = {
      input_path: resolved,
      output_path: resolvedOut,
      input_width: inputMeta.width ?? null,
      input_height: inputMeta.height ?? null,
      output_width: outputMeta.width ?? null,
      output_height: outputMeta.height ?? null,
      fit,
      position,
      input_size_bytes: inputSize,
      output_size_bytes: outputSize,
      ...sizeSavings(inputSize, outputSize),
    };

    return {
      content: [],
      structuredContent: result,
    };
  },
);
