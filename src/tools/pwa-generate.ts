import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { statSafe } from "@/lib/file-utils";
import { ImagePipeline } from "@/lib/image-pipeline";
import {
  assertOutputDirExists,
  resolveOutputPath,
  resolvePath,
} from "@/lib/paths";
import { handle } from "@/lib/tool";

export function registerPwaGenerateTool(server: McpServer) {
  server.registerTool(
    "pwa_generate",
    {
      title: "Generate PWA Icon Set",
      description:
        "Generates the complete PWA icon set (8 standard sizes from 72px to 512px, plus maskable variants at 192 and 512px with correct 80% safe zone) and a site.webmanifest from one source image. Call this when a manifest.json or site.webmanifest references icon paths that do not exist, when a service worker is being registered, or when a developer mentions installable app or home screen icon.",
      inputSchema: z.object({
        image_path: z
          .string()
          .describe("Path to the source image (square PNG recommended)"),
        output_dir: z
          .string()
          .describe(
            "Directory where icons and site.webmanifest will be written",
          ),
        name: z.string().describe("Full application name for the manifest"),
        short_name: z
          .string()
          .optional()
          .describe(
            "Short application name shown on home screens (defaults to name)",
          ),
        theme_color: z
          .string()
          .optional()
          .default("#ffffff")
          .describe(
            "Browser UI theme colour as a hex string (default: #ffffff)",
          ),
        background_color: z
          .string()
          .optional()
          .default("#ffffff")
          .describe(
            "Splash screen background colour as a hex string (default: #ffffff)",
          ),
        start_url: z
          .string()
          .optional()
          .default("/")
          .describe("URL opened when the PWA is launched (default: /)"),
        display: z
          .enum(["standalone", "fullscreen", "minimal-ui", "browser"])
          .optional()
          .default("standalone")
          .describe("Display mode (default: standalone)"),
      }),
    },
    pwaGenerateHandler,
  );
}

export const pwaGenerateHandler = handle(
  async ({
    image_path,
    output_dir,
    name,
    short_name,
    theme_color = "#ffffff",
    background_color = "#ffffff",
    start_url = "/",
    display = "standalone",
  }: {
    image_path: string;
    output_dir: string;
    name: string;
    short_name?: string;
    theme_color?: string;
    background_color?: string;
    start_url?: string;
    display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  }) => {
    const resolved = resolvePath(image_path);
    const resolvedDir = resolveOutputPath(output_dir);

    assertOutputDirExists(resolvedDir);

    const bg = parseHex(background_color);

    // Regular icons
    await Promise.all(
      REGULAR_SIZES.map((s) =>
        generateIcon(resolved, join(resolvedDir, `icon-${s}x${s}.png`), s, bg),
      ),
    );

    // Apple touch icon
    await generateIcon(
      resolved,
      join(resolvedDir, "apple-touch-icon.png"),
      APPLE_TOUCH_SIZE,
      bg,
    );

    // Maskable icons
    await Promise.all(
      MASKABLE_SIZES.map((s) =>
        generateMaskable(
          resolved,
          join(resolvedDir, `maskable-${s}x${s}.png`),
          s,
          bg,
        ),
      ),
    );

    const regularEntries = REGULAR_SIZES.map((s) =>
      fileEntry(resolvedDir, `icon-${s}x${s}.png`, s, "any"),
    );
    const maskableEntries = MASKABLE_SIZES.map((s) =>
      fileEntry(resolvedDir, `maskable-${s}x${s}.png`, s, "maskable"),
    );
    const appleEntry = fileEntry(
      resolvedDir,
      "apple-touch-icon.png",
      APPLE_TOUCH_SIZE,
      "any",
    );

    const allFiles = [...regularEntries, ...maskableEntries, appleEntry];

    const manifest = {
      name,
      short_name: short_name ?? name,
      start_url,
      display,
      theme_color,
      background_color,
      icons: [
        ...REGULAR_SIZES.map((s) => ({
          src: `icon-${s}x${s}.png`,
          sizes: `${s}x${s}`,
          type: "image/png",
        })),
        ...MASKABLE_SIZES.map((s) => ({
          src: `maskable-${s}x${s}.png`,
          sizes: `${s}x${s}`,
          type: "image/png",
          purpose: "maskable",
        })),
      ],
    };

    const manifestPath = join(resolvedDir, "site.webmanifest");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const html = [
      `<link rel="manifest" href="site.webmanifest">`,
      `<link rel="apple-touch-icon" sizes="${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}" href="apple-touch-icon.png">`,
      `<meta name="theme-color" content="${theme_color}">`,
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            output_dir: resolvedDir,
            name,
            files: allFiles,
            manifest,
            manifest_path: manifestPath,
            html,
          }),
        },
      ],
    };
  },
);

const REGULAR_SIZES = [72, 96, 128, 144, 152, 192, 384, 512] as const;
const MASKABLE_SIZES = [192, 512] as const;
const APPLE_TOUCH_SIZE = 180;
const MASKABLE_SAFE_ZONE = 0.8;

type Rgba = { r: number; g: number; b: number; alpha: number };

function parseHex(hex: string): Rgba {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    alpha: 1,
  };
}

async function generateIcon(
  source: string,
  outPath: string,
  size: number,
  bg: Rgba,
): Promise<void> {
  const pipeline = new ImagePipeline(source);
  await pipeline
    .resize({ width: size, height: size, fit: "contain", background: bg })
    .convert("png")
    .write(outPath);
}

async function generateMaskable(
  source: string,
  outPath: string,
  size: number,
  bg: Rgba,
): Promise<void> {
  const contentSize = Math.round(size * MASKABLE_SAFE_ZONE);
  const pad = Math.round((size - contentSize) / 2);
  const pipeline = new ImagePipeline(source);
  await pipeline
    .resize({
      width: contentSize,
      height: contentSize,
      fit: "contain",
      background: bg,
    })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
    .convert("png")
    .write(outPath);
}

function fileEntry(
  outDir: string,
  filename: string,
  size: number,
  purpose: "any" | "maskable",
) {
  const path = join(outDir, filename);
  const bytes = statSafe(path)?.size ?? 0;
  return {
    path,
    filename,
    size: `${size}x${size}`,
    purpose,
    size_bytes: bytes,
  };
}
