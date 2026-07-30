const LONG_SIDE_BY_SIZE = Object.freeze({
  "1K": 1280,
  "2K": 2048,
  "4K": 4096,
});

function loadArtwork(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The free artwork detail could not read this image."));
    };
    image.src = url;
  });
}

function ratioValue(aspectRatio) {
  const [width, height] = String(aspectRatio || "4:5").split(":").map(Number);
  if (!width || !height) return 4 / 5;
  return width / height;
}

function outputDimensions(aspectRatio, imageSize) {
  const targetRatio = ratioValue(aspectRatio);
  const longSide = LONG_SIDE_BY_SIZE[imageSize] || LONG_SIDE_BY_SIZE["2K"];
  if (targetRatio >= 1) {
    return { width: longSide, height: Math.max(1, Math.round(longSide / targetRatio)), targetRatio };
  }
  return { width: Math.max(1, Math.round(longSide * targetRatio)), height: longSide, targetRatio };
}

function detailFilename(originalName, aspectRatio) {
  const base = String(originalName || "artwork").replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "artwork";
  return `${base}-zoom-detail-${String(aspectRatio || "4:5").replace(":", "x")}.jpg`;
}

export async function createArtworkDetail(file, { aspectRatio = "4:5", imageSize = "2K", zoom = 1.55 } = {}) {
  const image = await loadArtwork(file);
  const { width, height, targetRatio } = outputDimensions(aspectRatio, imageSize);
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let cropWidth;
  let cropHeight;

  if (sourceRatio > targetRatio) {
    cropHeight = image.naturalHeight;
    cropWidth = cropHeight * targetRatio;
  } else {
    cropWidth = image.naturalWidth;
    cropHeight = cropWidth / targetRatio;
  }

  const safeZoom = Math.min(2.2, Math.max(1.15, Number(zoom) || 1.55));
  cropWidth /= safeZoom;
  cropHeight /= safeZoom;
  const sourceX = (image.naturalWidth - cropWidth) / 2;
  const sourceY = (image.naturalHeight - cropHeight) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create the free artwork detail.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("The free artwork detail could not be encoded.")),
    "image/jpeg",
    0.94,
  ));

  return {
    blob,
    width,
    height,
    aspectRatio,
    imageSize,
    filename: detailFilename(file.name, aspectRatio),
  };
}

export function artworkDetailResult(detail) {
  return {
    id: `local-detail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blob: detail.blob,
    dataUrl: URL.createObjectURL(detail.blob),
    filename: detail.filename,
    prompt: "Free local artwork crop · no credits",
    localDetail: true,
    width: detail.width,
    height: detail.height,
    aspectRatio: detail.aspectRatio,
  };
}
