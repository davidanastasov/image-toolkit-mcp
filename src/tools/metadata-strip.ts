import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  resolveOutputPath,
  resolvePath,
} from "@/lib/paths";
import { handle } from "@/lib/tool";

export function registerMetadataStripTool(server: McpServer) {
  server.registerTool(
    "metadata_strip",
    {
      title: "Strip Image Metadata",
      description:
        "Removes all EXIF, XMP, and IPTC metadata from an image and normalises the colour space to sRGB. Call this before publishing or uploading any image that may have come from a camera or phone, when user-uploaded images are being processed (EXIF can contain GPS coordinates and device identifiers), when a developer mentions privacy, GDPR, or removing personal data from images, or when preparing images for a public-facing website.",
      inputSchema: z.object({
        image_path: z.string().describe("Path to the source image"),
        output_path: z
          .string()
          .describe("Where to write the metadata-stripped image"),
      }),
    },
    metadataStripHandler,
  );
}

export const metadataStripHandler = handle(
  async ({
    image_path,
    output_path,
  }: {
    image_path: string;
    output_path: string;
  }) => {
    const resolved = resolvePath(image_path);
    const resolvedOut = resolveOutputPath(output_path);

    assertOutputDirExists(dirname(resolvedOut));

    const pipeline = new ImagePipeline(resolved);
    const inputMeta = await pipeline.metadata();
    const hadExif = !!inputMeta.exif;
    const hadIcc = !!inputMeta.icc;
    const inputSize = pipeline.getInputSize();

    // Sharp offers two modes: strip everything (default, no .withMetadata()) or keep
    // everything (.withMetadata()). There is no supported way to strip EXIF/XMP while
    // selectively retaining the ICC profile buffer. The strip-all path is correct for
    // web publishing because sharp automatically normalises the colour space to sRGB,
    // which is what browsers expect regardless of the original profile.
    const { size: outputSize } = await pipeline
      .stripMetadata()
      .write(resolvedOut);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            input_path: resolved,
            output_path: resolvedOut,
            had_exif: hadExif,
            had_icc: hadIcc,
            input_size_bytes: inputSize,
            output_size_bytes: outputSize,
            stripped_bytes: inputSize - outputSize,
          }),
        },
      ],
    };
  },
);
