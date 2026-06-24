import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { readImageMetadata } from "@/lib/image-pipeline";
import { resolvePath } from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.infer<typeof metadataReadToolInputSchema>;
const metadataReadToolInputSchema = z.object({
  image_path: z
    .string()
    .describe("Absolute or relative path to the image file"),
});

type OutputSchema = z.infer<typeof metadataReadToolOutputSchema>;
const metadataReadToolOutputSchema = z.object({
  file_path: z.string(),
  file_size_bytes: z.number(),
  format: z.string(),
  width: z.number(),
  height: z.number(),
  aspect_ratio: z.string().nullable(),
  color_space: z.string().nullable(),
  channels: z.number().nullable(),
  bit_depth: z.number().nullable(),
  has_alpha: z.boolean(),
  dpi: z.number().nullable(),
  is_progressive: z.boolean().nullable(),
  chroma_subsampling: z.string().nullable(),
  orientation: z.number(),
  is_animated: z.boolean(),
  frame_count: z.number(),
  has_icc_profile: z.boolean(),
  has_exif: z.boolean(),
  exif: z
    .object({
      make: z.string().nullable(),
      model: z.string().nullable(),
      date_taken: z.string().nullable(),
      gps_lat: z.number().nullable(),
      gps_lng: z.number().nullable(),
      iso: z.number().nullable(),
      exposure_time: z.string().nullable(),
      f_number: z.number().nullable(),
      flash: z.boolean().nullable(),
    })
    .nullable(),
  warnings: z.array(z.string()),
});

export function registerMetadataReadTool(server: McpServer) {
  server.registerTool(
    "metadata_read",
    {
      title: "Read Image Metadata",
      description:
        "Reads an image's dimensions, format, color space, DPI, file size, and full decoded EXIF data including camera make/model, GPS coordinates, and exposure settings. Call this before resizing, compressing, or converting any image to understand what you are working with, whenever a developer asks about an image's properties or dimensions, and when deciding which optimization to apply (e.g. checking color space before converting, checking dimensions before downsizing).",
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: metadataReadToolInputSchema,
      outputSchema: metadataReadToolOutputSchema,
    },
    metadataReadToolHandler satisfies ToolHandler<InputSchema>,
  );
}

export const metadataReadToolHandler = handle<InputSchema, OutputSchema>(
  async ({ image_path }) => {
    const resolved = resolvePath(image_path);
    const result = await readImageMetadata(resolved);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);
