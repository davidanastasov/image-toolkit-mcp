export const SUPPORTED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "tiff",
  "heif",
  "svg",
  "jp2",
  "jxl",
]);

export const EXIF_PICK_KEYS = [
  "Make",
  "Model",
  "DateTimeOriginal",
  "ISO",
  "ExposureTime",
  "FNumber",
  "Flash",
] as const;

/** Maps Sharp format names to canonical file extensions. */
export const FORMAT_EXT: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  avif: ".avif",
  tiff: ".tiff",
  gif: ".gif",
  heif: ".heif",
};

export const FIT_OPTIONS = [
  "cover",
  "contain",
  "fill",
  "inside",
  "outside",
] as const;
