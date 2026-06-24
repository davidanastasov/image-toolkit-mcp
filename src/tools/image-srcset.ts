import { basename, extname, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { FORMAT_EXT } from "@/lib/constants";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  resolveOutputPath,
  resolvePath,
} from "@/lib/paths";
import { handle, type ToolHandler } from "@/lib/tool";

type InputSchema = z.infer<typeof imageSrcsetToolInputSchema>;
const imageSrcsetToolInputSchema = z.object({
  image_path: z.string().describe("Path to the source image"),
  output_dir: z
    .string()
    .describe("Directory where the resized variants will be written"),
  widths: z
    .array(z.number().int().positive())
    .min(1)
    .describe(
      "Target widths in pixels, e.g. [400, 800, 1200]. Each width produces one output file.",
    ),
  format: z
    .enum(["webp", "jpeg", "png", "avif"])
    .default("webp")
    .optional()
    .describe("Output format for all variants (default: webp)"),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(80)
    .optional()
    .describe("Output quality 1–100 for lossy formats (default: 80)"),
});

const imageSrcsetFileSchema = z.object({
  width: z.number().describe("Target width in pixels"),
  path: z.string().describe("Resolved absolute path to the generated file"),
  size_bytes: z.number().describe("Size of the generated file in bytes"),
});

type OutputSchema = z.infer<typeof imageSrcsetToolOutputSchema>;
const imageSrcsetToolOutputSchema = z.object({
  input_path: z.string().describe("Resolved absolute path to the source image"),
  output_dir: z
    .string()
    .describe("Resolved absolute path to the output directory"),
  format: z.string().describe("Output format used for all variants"),
  quality: z.number().describe("Output quality used for all variants"),
  files: z
    .array(imageSrcsetFileSchema)
    .describe("Generated variant files, sorted by width ascending"),
  srcset: z.string().describe("Ready-to-use HTML srcset attribute value"),
  html: z
    .string()
    .describe("Ready-to-use <img> snippet with srcset and sizes attributes"),
});

export function registerImageSrcsetTool(server: McpServer) {
  server.registerTool(
    "image_srcset",
    {
      title: "Generate Responsive Srcset",
      description:
        "Generates multiple resized variants of an image for use in an HTML srcset attribute — one file per requested width. Returns the generated file paths, a ready-to-use srcset string, and an <img> snippet. Default output format is WebP for best compression. Use after metadata_read to know the natural dimensions before choosing target widths.",
      inputSchema: imageSrcsetToolInputSchema,
      outputSchema: imageSrcsetToolOutputSchema,
    },
    imageSrcsetHandler satisfies ToolHandler<InputSchema>,
  );
}

export const imageSrcsetHandler = handle<InputSchema, OutputSchema>(
  async ({ image_path, output_dir, widths, format = "webp", quality = 80 }) => {
    const resolved = resolvePath(image_path);
    const resolvedDir = resolveOutputPath(output_dir);

    assertOutputDirExists(resolvedDir);

    const ext = FORMAT_EXT[format];
    const base = basename(resolved, extname(resolved));
    const sortedWidths = [...widths].sort((a, b) => a - b);

    const files = await Promise.all(
      sortedWidths.map(async (w) => {
        const filename = `${base}-${w}w${ext}`;
        const outPath = join(resolvedDir, filename);

        const pipeline = new ImagePipeline(resolved);
        const { size } = await pipeline
          .resize({ width: w, fit: "inside" })
          .convert(format, quality)
          .write(outPath);

        return { width: w, path: outPath, size_bytes: size };
      }),
    );

    const srcset = files.map((f) => `${f.path} ${f.width}w`).join(", ");
    const html = `<img srcset="${srcset}" sizes="100vw" alt="">`;

    const result: OutputSchema = {
      input_path: resolved,
      output_dir: resolvedDir,
      format,
      quality,
      files,
      srcset,
      html,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);
