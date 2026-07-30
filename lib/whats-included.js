const LONG_SIDE_BY_SIZE = Object.freeze({
  "1K": 1280,
  "2K": 2048,
  "4K": 4096,
});

const FRAME_OPENING = Object.freeze({ x: 0.075, y: 0.194, width: 0.458, height: 0.613 });

function loadImage(source) {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      reject(new Error("The what's included page could not read this image."));
    };
    image.src = url;
  });
}

function drawCover(context, image, x, y, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = sourceHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = sourceWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawText(context, text, x, y, size, options = {}) {
  context.fillStyle = options.color || "#171717";
  context.font = `${options.weight || 400} ${size}px Georgia, "Times New Roman", serif`;
  context.textAlign = options.align || "left";
  context.textBaseline = "alphabetic";
  context.fillText(text, x, y);
}

function drawDefaultTemplate(context, size, artwork) {
  const scale = size / 1676;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const frame = {
    x: Math.round(FRAME_OPENING.x * size),
    y: Math.round(FRAME_OPENING.y * size),
    width: Math.round(FRAME_OPENING.width * size),
    height: Math.round(FRAME_OPENING.height * size),
  };
  drawCover(context, artwork, frame.x, frame.y, frame.width, frame.height);
  context.strokeStyle = "#20201e";
  context.lineWidth = Math.max(4, Math.round(6 * scale));
  context.strokeRect(frame.x - context.lineWidth / 2, frame.y - context.lineWidth / 2, frame.width + context.lineWidth, frame.height + context.lineWidth);

  const centerX = 1250 * scale;
  drawText(context, "WALL ART ROSES", centerX, 394 * scale, 43 * scale, { align: "center" });
  context.strokeStyle = "#8d8d89";
  context.lineWidth = Math.max(1, 2 * scale);
  context.beginPath();
  context.moveTo(1034 * scale, 416 * scale);
  context.lineTo(1467 * scale, 416 * scale);
  context.stroke();
  drawText(context, "MOODY WALL ART, TIMELESS ELEGANCE", centerX, 464 * scale, 28 * scale, { align: "center" });

  const left = 956 * scale;
  drawText(context, "Purchase → Download → Print/Frame", left, 631 * scale, 28 * scale, { weight: 700 });
  drawText(context, "Includes multiple size ratios", left, 694 * scale, 28 * scale);
  drawText(context, "2:3 | 3:4 | 4:5 | A-Series", left, 734 * scale, 28 * scale);
  drawText(context, "Instant download – no physical item will be", left, 795 * scale, 28 * scale);
  drawText(context, "shipped.", left, 835 * scale, 28 * scale);
  drawText(context, "Print up to 24x36 inches", left, 897 * scale, 28 * scale);
  drawText(context, "What you receive:", left, 961 * scale, 28 * scale);
  drawText(context, "• 5 JPG Files", 977 * scale, 1010 * scale, 27 * scale);
  drawText(context, "• Instant Digital Download", 977 * scale, 1048 * scale, 27 * scale);
  drawText(context, "• No Physical Items Shipped", 977 * scale, 1086 * scale, 27 * scale);
  drawText(context, "Colors may vary slightly due to monitor and printer settings.", left, 1274 * scale, 22 * scale);
}

function cleanFilename(originalName) {
  const base = String(originalName || "artwork")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "artwork";
  return `${base}-whats-included.jpg`;
}

export async function createWhatsIncludedPage(artworkFile, { templateFile = null, imageSize = "2K" } = {}) {
  const size = LONG_SIDE_BY_SIZE[imageSize] || LONG_SIDE_BY_SIZE["2K"];
  const artwork = await loadImage(artworkFile);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create the what's included page.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (templateFile) {
    const template = await loadImage(templateFile);
    drawCover(context, template, 0, 0, size, size);
    const frame = {
      x: Math.round(FRAME_OPENING.x * size),
      y: Math.round(FRAME_OPENING.y * size),
      width: Math.round(FRAME_OPENING.width * size),
      height: Math.round(FRAME_OPENING.height * size),
    };
    drawCover(context, artwork, frame.x, frame.y, frame.width, frame.height);
  } else {
    drawDefaultTemplate(context, size, artwork);
  }

  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("The what's included page could not be encoded.")),
    "image/jpeg",
    0.94,
  ));

  return {
    blob,
    width: size,
    height: size,
    aspectRatio: "1:1",
    imageSize,
    filename: cleanFilename(artworkFile.name),
    templateName: templateFile?.name || "Wall Art Roses default",
  };
}

export function whatsIncludedResult(page) {
  return {
    id: `local-included-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blob: page.blob,
    dataUrl: URL.createObjectURL(page.blob),
    filename: page.filename,
    prompt: "Free local what's included page · no credits",
    localWhatsIncluded: true,
    width: page.width,
    height: page.height,
    aspectRatio: "1:1",
  };
}
