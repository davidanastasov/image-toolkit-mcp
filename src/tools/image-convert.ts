import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { FORMAT_EXT } from "@/lib/constants";
import { sizeSavings } from "@/lib/file-utils";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  assertOutputFileNotExists,
  resolveOutputFilePath,
  resolvePath,
} from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.infer<typeof imageConvertToolInputSchema>;
const imageConvertToolInputSchema = z.object({
  image_path: z.string().describe("Path to the source image"),
  format: z
    .enum(["jpeg", "png", "webp", "avif", "tiff", "gif", "heif"])
    .describe("Target format to convert to"),
  output_path: z
    .string()
    .optional()
    .describe(
      "Optional output directory or file path. If omitted, saves next to the source image. If a directory is given, the source filename is used with the new extension.",
    ),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(100)
    .optional()
    .describe("Output quality 1–100 for lossy formats (default: 100)"),
});

type OutputSchema = z.infer<typeof imageConvertToolOutputSchema>;
const imageConvertToolOutputSchema = z.object({
  input_path: z.string().describe("Resolved absolute path to the source image"),
  output_path: z
    .string()
    .describe("Resolved absolute path to the converted image"),
  input_format: z.string().nullable().describe("Format of the source image"),
  output_format: z.string().describe("Format of the converted image"),
  width: z
    .number()
    .nullable()
    .describe("Width of the converted image in pixels"),
  height: z
    .number()
    .nullable()
    .describe("Height of the converted image in pixels"),
  input_size_bytes: z.number().describe("Size of the source image in bytes"),
  output_size_bytes: z
    .number()
    .describe("Size of the converted image in bytes"),
  savings_bytes: z
    .number()
    .describe("Number of bytes saved (input_size_bytes - output_size_bytes)"),
  savings_percent: z
    .number()
    .describe(
      "Percentage reduction in size (savings_bytes / input_size_bytes * 100)",
    ),
});

export function registerImageConvertTool(server: McpServer) {
  server.registerTool(
    "image_convert",
    {
      title: "Convert Image Format",
      description:
        "Converts an image to a different format determined by the output path's file extension. Returns before/after sizes so you can evaluate the trade-off. WebP typically saves 25–35% over JPEG at equivalent visual quality; AVIF saves more but is slower to encode. Supported output extensions: .jpg, .png, .webp, .avif, .tiff, .gif, .heif, .heic.",
      inputSchema: imageConvertToolInputSchema,
      outputSchema: imageConvertToolOutputSchema,
    },
    imageConvertHandler satisfies ToolHandler<InputSchema>,
  );
}

export const imageConvertHandler = handle<InputSchema, OutputSchema>(
  async ({ image_path, format, output_path, quality }) => {
    const ext = FORMAT_EXT[format] ?? `.${format}`;
    const resolvedInput = resolvePath(image_path);
    const resolvedOutput = resolveOutputFilePath(image_path, output_path, ext);

    assertOutputDirExists(dirname(resolvedOutput));
    assertOutputFileNotExists(resolvedOutput);

    const pipeline = new ImagePipeline(resolvedInput);
    const inputMetadata = await pipeline.metadata();
    const inputSize = pipeline.getInputSize();

    const { size: outputSize, meta: outputMeta } = await pipeline
      .convert(format, quality)
      .write(resolvedOutput);

    const result: OutputSchema = {
      input_path: resolvedInput,
      output_path: resolvedOutput,
      input_format: inputMetadata.format,
      output_format: format,
      width: outputMeta.width,
      height: outputMeta.height,
      input_size_bytes: inputSize,
      output_size_bytes: outputSize,
      ...sizeSavings(inputSize, outputSize),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);
