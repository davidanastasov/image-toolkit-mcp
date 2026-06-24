import exifr from "exifr";
import sharp from "sharp";
import { EXIF_PICK_KEYS, SUPPORTED_FORMATS } from "./constants";
import { ErrorCode, ImageProcessingError } from "./error";
import { statSafe } from "./file-utils";
import { gcd } from "./math";

// #region Metadata Reading
export async function readImageMetadata(resolvedPath: string) {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(resolvedPath).metadata();
  } catch {
    throw new ImageProcessingError(
      ErrorCode.UNSUPPORTED_FORMAT,
      `Cannot read image metadata — file may be corrupt or an unsupported format. Supported formats: ${[...SUPPORTED_FORMATS].join(", ")}`,
    );
  }

  if (!SUPPORTED_FORMATS.has(meta.format)) {
    throw new ImageProcessingError(
      ErrorCode.UNSUPPORTED_FORMAT,
      `Unsupported image format: ${meta.format}. Supported formats: ${[...SUPPORTED_FORMATS].join(", ")}`,
    );
  }

  const stats = statSafe(resolvedPath);

  const exifData = meta.exif
    ? await readExif(resolvedPath).catch(() => null)
    : null;

  const bitDepth = mapBitDepth(meta.depth);
  const frameCount = meta.pages ?? 1;

  return {
    file_path: resolvedPath,
    file_size_bytes: stats?.size ?? 0,
    format: meta.format,
    width: meta.width,
    height: meta.height,
    aspect_ratio:
      meta.width && meta.height
        ? computeAspectRatio(meta.width, meta.height)
        : null,
    color_space: meta.space,
    channels: meta.channels,
    bit_depth: bitDepth,
    has_alpha: meta.hasAlpha,
    dpi: meta.density ?? null,
    is_progressive: meta.isProgressive,
    chroma_subsampling: meta.chromaSubsampling ?? null,
    orientation: meta.orientation ?? 1,
    is_animated: frameCount > 1,
    frame_count: frameCount,
    has_icc_profile: meta.hasProfile,
    has_exif: exifData !== null,
    exif: exifData,
    warnings: buildWarnings(meta, bitDepth),
  };
}

function computeAspectRatio(width: number, height: number): string {
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

function mapBitDepth(depth: string | undefined): number | null {
  if (depth === "uchar") return 8;
  if (depth === "ushort") return 16;
  return null;
}

function formatExposureTime(value: number | undefined | null): string | null {
  if (value == null) return null;
  if (value >= 1) return `${value}s`;
  return `1/${Math.round(1 / value)}`;
}

function flashFired(value: number | undefined | null): boolean | null {
  if (value == null) return null;
  return (value & 1) === 1;
}

async function readExif(filePath: string) {
  const [fields, gps] = await Promise.all([
    exifr.parse(filePath, {
      pick: EXIF_PICK_KEYS as unknown as string[],
      translateValues: false,
    }) as Promise<Record<string, unknown> | undefined>,
    exifr.gps(filePath) as Promise<
      { latitude: number; longitude: number } | undefined
    >,
  ]);

  if (!fields && !gps) return null;

  const raw = fields ?? {};
  return {
    make: (raw.Make as string | undefined) ?? null,
    model: (raw.Model as string | undefined) ?? null,
    date_taken:
      (raw.DateTimeOriginal as Date | undefined)?.toISOString() ?? null,
    gps_lat: gps?.latitude ?? null,
    gps_lng: gps?.longitude ?? null,
    iso: (raw.ISO as number | undefined) ?? null,
    exposure_time: formatExposureTime(raw.ExposureTime as number | undefined),
    f_number: (raw.FNumber as number | undefined) ?? null,
    flash: flashFired(raw.Flash as number | undefined),
  };
}

function buildWarnings(
  meta: sharp.Metadata,
  bitDepth: number | null,
): string[] {
  const warnings: string[] = [];

  if (meta.space === "cmyk") {
    warnings.push(
      "CMYK color space detected. Convert to sRGB before web publishing.",
    );
  }

  if (bitDepth === 16) {
    warnings.push(
      "16-bit depth detected. Convert to 8-bit for web use — 16-bit roughly doubles file size with no visible benefit.",
    );
  }

  const orientation = meta.orientation ?? 1;
  if (orientation > 1) {
    warnings.push(
      `EXIF orientation is ${orientation}. Apply rotation before publishing — some browsers ignore the orientation tag and will display the image rotated.`,
    );
  }

  return warnings;
}
// #endregion

export class ImagePipeline {
  private pipeline: sharp.Sharp;
  private imagePath?: string;
  private inputSize: number = 0;

  constructor(input: string | Buffer) {
    this.pipeline = sharp(input);
    if (typeof input === "string") {
      this.imagePath = input;
      this.inputSize = statSafe(input)?.size ?? 0;
    } else {
      this.inputSize = input.length;
    }
  }

  resize(options: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    position?: string;
    background?: sharp.Color;
  }): this {
    this.pipeline = this.pipeline.resize(options);
    return this;
  }

  extend(options: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
    background?: sharp.Color;
  }): this {
    this.pipeline = this.pipeline.extend(options);
    return this;
  }

  convert(format: string, quality: number = 80): this {
    switch (format) {
      case "jpeg":
        this.pipeline = this.pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "webp":
        this.pipeline = this.pipeline.webp({ quality });
        break;
      case "png":
        this.pipeline = this.pipeline.png(); // Lossless configuration for conversions
        break;
      case "avif":
        this.pipeline = this.pipeline.avif({ quality });
        break;
      case "tiff":
        this.pipeline = this.pipeline.tiff({ quality });
        break;
      case "gif":
        this.pipeline = this.pipeline.gif();
        break;
      case "heif":
      case "heic":
        this.pipeline = this.pipeline.heif({ quality });
        break;
    }
    return this;
  }

  compress(format: string, quality: number = 80): this {
    switch (format) {
      case "jpeg":
        this.pipeline = this.pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "webp":
        this.pipeline = this.pipeline.webp({ quality });
        break;
      case "png":
        this.pipeline =
          quality < 100
            ? this.pipeline.png({ quality, palette: true })
            : this.pipeline.png({ compressionLevel: 9 });
        break;
      case "avif":
        this.pipeline = this.pipeline.avif({ quality });
        break;
      case "tiff":
        this.pipeline = this.pipeline.tiff({ quality });
        break;
      case "gif":
        this.pipeline = this.pipeline.gif();
        break;
      case "heif":
      case "heic":
        this.pipeline = this.pipeline.heif({ quality });
        break;
    }
    return this;
  }

  stripMetadata(): this {
    // @ts-ignore
    this.pipeline = this.pipeline.withMetadata(false);
    return this;
  }

  async write(
    outputPath: string,
  ): Promise<{ size: number; meta: sharp.Metadata }> {
    await this.pipeline.toFile(outputPath);
    const meta = await sharp(outputPath).metadata();
    const size = statSafe(outputPath)?.size ?? 0;
    return { size, meta };
  }

  async toBuffer(): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    // @ts-ignore
    return this.pipeline.toBuffer({ resolveWithObject: true });
  }

  async metadata(): Promise<sharp.Metadata> {
    return this.pipeline.metadata();
  }

  getInputSize(): number {
    return this.inputSize;
  }
}
