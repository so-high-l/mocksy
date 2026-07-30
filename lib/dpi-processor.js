import { setImageDpi } from "./dpi";

export const MAX_DPI_FILES = 5;
export const MAX_ETSY_FILE_SIZE = 20 * 1024 * 1024;
export const DPI_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export function formatImageBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function loadImage(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => {
      URL.revokeObjectURL(url);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image preview could not be read."));
    };
    element.src = url;
  });
}

export async function getImageDimensions(file) {
  const image = await loadImage(file);
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    label: `${image.naturalWidth} × ${image.naturalHeight}px`,
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The optimized image could not be created.")),
      type,
      quality,
    );
  });
}

async function encodeAtSize(image, width, height, type, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: type === "image/png" });
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  const encoded = await canvasToBlob(canvas, type, quality);
  const withDpi = setImageDpi(await encoded.arrayBuffer(), type);
  return new Blob([withDpi], { type });
}

async function bestJpegAtSize(image, width, height) {
  const minimumQuality = 0.78;
  const maximumQuality = 0.98;
  const smallest = await encodeAtSize(image, width, height, "image/jpeg", minimumQuality);
  if (smallest.size > MAX_ETSY_FILE_SIZE) return { fits: false, sampleSize: smallest.size };

  const largest = await encodeAtSize(image, width, height, "image/jpeg", maximumQuality);
  if (largest.size <= MAX_ETSY_FILE_SIZE) return { fits: true, blob: largest };

  let low = minimumQuality;
  let high = maximumQuality;
  let best = smallest;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const quality = (low + high) / 2;
    const candidate = await encodeAtSize(image, width, height, "image/jpeg", quality);
    if (candidate.size <= MAX_ETSY_FILE_SIZE) {
      best = candidate;
      low = quality;
    } else {
      high = quality;
    }
  }
  return { fits: true, blob: best };
}

function nextDimensions(width, height, currentSize) {
  const estimated = Math.sqrt(MAX_ETSY_FILE_SIZE / currentSize) * 0.97;
  const factor = Math.min(0.92, Math.max(0.65, estimated));
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}

export async function optimizeArtworkForEtsy(file) {
  const sourceWithDpi = new Blob([setImageDpi(await file.arrayBuffer(), file.type)], { type: file.type });
  const dimensions = await getImageDimensions(file);
  if (sourceWithDpi.size <= MAX_ETSY_FILE_SIZE) {
    return {
      blob: sourceWithDpi,
      optimized: false,
      width: dimensions.width,
      height: dimensions.height,
      dimensions: dimensions.label,
    };
  }

  const image = await loadImage(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (file.type === "image/jpeg") {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await bestJpegAtSize(image, width, height);
      if (result.fits && result.blob.size <= MAX_ETSY_FILE_SIZE) {
        return { blob: result.blob, optimized: true, width, height, dimensions: `${width} × ${height}px` };
      }
      ({ width, height } = nextDimensions(width, height, result.sampleSize));
    }
  } else {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = await encodeAtSize(image, width, height, "image/png");
      if (candidate.size <= MAX_ETSY_FILE_SIZE) {
        return { blob: candidate, optimized: true, width, height, dimensions: `${width} × ${height}px` };
      }
      ({ width, height } = nextDimensions(width, height, candidate.size));
    }
  }

  throw new Error("This image could not be reduced below Etsy’s 20 MB limit safely.");
}
