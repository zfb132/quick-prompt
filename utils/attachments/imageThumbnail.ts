const DEFAULT_MAX_THUMBNAIL_SIZE = 192;
const DEFAULT_THUMBNAIL_QUALITY = 0.72;

type ThumbnailSource = CanvasImageSource & {
  width: number;
  height: number;
  close?: () => void;
};

const isImageFile = (file: File): boolean => file.type.toLowerCase().startsWith("image/");

const getTargetSize = (
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxSize, height: maxSize };
  }

  const scale = Math.min(maxSize / width, maxSize / height, 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const loadThumbnailSource = async (file: File): Promise<ThumbnailSource> => {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }

  throw new Error("Image thumbnail generation is not available");
};

export const createImageThumbnailDataUrl = async (
  file: File,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string | undefined> => {
  if (!isImageFile(file) || typeof document === "undefined") {
    return undefined;
  }

  let source: ThumbnailSource | undefined;

  try {
    source = await loadThumbnailSource(file);
    const maxSize = options.maxSize ?? DEFAULT_MAX_THUMBNAIL_SIZE;
    const quality = options.quality ?? DEFAULT_THUMBNAIL_QUALITY;
    const target = getTargetSize(source.width, source.height, maxSize);
    const canvas = document.createElement("canvas");

    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    context.drawImage(source, 0, 0, target.width, target.height);

    const dataUrl = canvas.toDataURL("image/webp", quality);
    return dataUrl.startsWith("data:image/") ? dataUrl : undefined;
  } catch {
    return undefined;
  } finally {
    source?.close?.();
  }
};
