import { dirname, extname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { sizeSavings } from "@/lib/file-utils";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  assertOutputFileNotExists,
  resolveOutputFilePath,
  resolvePath,
} from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.infer<typeof imageCompressToolInputSchema>;
const imageCompressToolInputSchema = z.object({
  image_path: z.string().describe("Path to the source image"),
  output_path: z
    .string()
    .describe(
      "Where to write the compressed image. The output extension is forced to match the source format.",
    ),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(80)
    .optional()
    .describe("Compression quality 1–100 (default: 80)"),
});

type OutputSchema = z.infer<typeof imageCompressToolOutputSchema>;
const imageCompressToolOutputSchema = z.object({
  input_path: z.string().describe("Resolved absolute path to the source image"),
  output_path: z
    .string()
    .describe("Resolved absolute path to the compressed image"),
  quality: z.number().describe("Compression quality that was applied"),
  input_size_bytes: z.number().describe("Size of the source image in bytes"),
  output_size_bytes: z
    .number()
    .describe("Size of the compressed image in bytes"),
  savings_bytes: z
    .number()
    .describe("Number of bytes saved (input_size_bytes - output_size_bytes)"),
  savings_percent: z.number().describe("Percentage reduction in size"),
});

export function registerImageCompressTool(server: McpServer) {
  server.registerTool(
    "image_compress",
    {
      title: "Compress Image",
      description:
        "Re-encodes an image at a lower quality to reduce file size, keeping the same format. Returns before/after sizes and the percentage saved. Quality 80 is a good starting point for JPEG and WebP; go lower (60–70) for images where fine detail is not critical. Use after metadata_read to confirm the image is oversized before compressing.",
      inputSchema: imageCompressToolInputSchema,
      outputSchema: imageCompressToolOutputSchema,
    },
    imageCompressHandler satisfies ToolHandler<InputSchema>,
  );
}

export const imageCompressHandler = handle<InputSchema, OutputSchema>(
  async ({ image_path, output_path, quality = 80 }) => {
    const resolvedInput = resolvePath(image_path);
    const enforcedExt = extname(resolvedInput);
    const resolvedOutput = resolveOutputFilePath(
      resolvedInput,
      output_path,
      enforcedExt,
    );

    assertOutputDirExists(dirname(resolvedOutput));
    assertOutputFileNotExists(resolvedOutput);

    const pipeline = new ImagePipeline(resolvedInput);
    const inputSize = pipeline.getInputSize();
    const { format } = await pipeline.metadata();

    const { size: outputSize } = await pipeline
      .compress(format, quality)
      .write(resolvedOutput);

    const result: OutputSchema = {
      input_path: resolvedInput,
      output_path: resolvedOutput,
      quality,
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
