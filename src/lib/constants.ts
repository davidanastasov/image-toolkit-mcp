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
