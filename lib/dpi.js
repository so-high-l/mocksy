const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PIXELS_PER_METER_300_DPI = 11811;

function writeUint16(bytes, offset, value, littleEndian = false) {
  if (littleEndian) {
    bytes[offset] = value & 255;
    bytes[offset + 1] = (value >>> 8) & 255;
  } else {
    bytes[offset] = (value >>> 8) & 255;
    bytes[offset + 1] = value & 255;
  }
}

function readUint16(bytes, offset, littleEndian = false) {
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

function writeUint32(bytes, offset, value, littleEndian = false) {
  if (littleEndian) {
    bytes[offset] = value & 255;
    bytes[offset + 1] = (value >>> 8) & 255;
    bytes[offset + 2] = (value >>> 16) & 255;
    bytes[offset + 3] = (value >>> 24) & 255;
  } else {
    bytes[offset] = (value >>> 24) & 255;
    bytes[offset + 1] = (value >>> 16) & 255;
    bytes[offset + 2] = (value >>> 8) & 255;
    bytes[offset + 3] = value & 255;
  }
}

function readUint32(bytes, offset, littleEndian = false) {
  if (littleEndian) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function updateExifResolution(bytes, contentOffset, segmentEnd) {
  if (ascii(bytes, contentOffset, 6) !== "Exif\u0000\u0000") return;
  const tiff = contentOffset + 6;
  if (tiff + 8 > segmentEnd) return;
  const byteOrder = ascii(bytes, tiff, 2);
  if (byteOrder !== "II" && byteOrder !== "MM") return;
  const littleEndian = byteOrder === "II";
  if (readUint16(bytes, tiff + 2, littleEndian) !== 42) return;
  const ifd = tiff + readUint32(bytes, tiff + 4, littleEndian);
  if (ifd + 2 > segmentEnd) return;
  const entries = readUint16(bytes, ifd, littleEndian);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > segmentEnd) break;
    const tag = readUint16(bytes, entry, littleEndian);
    if (tag === 0x0128) writeUint16(bytes, entry + 8, 2, littleEndian);
    if (tag === 0x011a || tag === 0x011b) {
      const valueOffset = tiff + readUint32(bytes, entry + 8, littleEndian);
      if (valueOffset + 8 <= segmentEnd) {
        writeUint32(bytes, valueOffset, 300, littleEndian);
        writeUint32(bytes, valueOffset + 4, 1, littleEndian);
      }
    }
  }
}

function setJpegDpi(input) {
  const bytes = new Uint8Array(input);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("This JPG file is not valid.");
  const output = bytes.slice();
  let offset = 2;
  let foundJfif = false;

  while (offset + 4 <= output.length && output[offset] === 0xff) {
    const marker = output[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    const length = readUint16(output, offset + 2);
    if (length < 2 || offset + 2 + length > output.length) break;
    const content = offset + 4;
    const segmentEnd = offset + 2 + length;
    if (marker === 0xe0 && ascii(output, content, 5) === "JFIF\u0000" && length >= 14) {
      output[content + 7] = 1;
      writeUint16(output, content + 8, 300);
      writeUint16(output, content + 10, 300);
      foundJfif = true;
    }
    if (marker === 0xe1) updateExifResolution(output, content, segmentEnd);
    offset = segmentEnd;
  }

  if (foundJfif) return output;
  const jfif = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x02, 0x01,
    0x01, 0x2c, 0x01, 0x2c,
    0x00, 0x00,
  ]);
  const combined = new Uint8Array(output.length + jfif.length);
  combined.set(output.slice(0, 2), 0);
  combined.set(jfif, 2);
  combined.set(output.slice(2), 2 + jfif.length);
  return combined;
}

function makePhysChunk() {
  const chunk = new Uint8Array(21);
  writeUint32(chunk, 0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  writeUint32(chunk, 8, PIXELS_PER_METER_300_DPI);
  writeUint32(chunk, 12, PIXELS_PER_METER_300_DPI);
  chunk[16] = 1;
  writeUint32(chunk, 17, crc32(chunk.slice(4, 17)));
  return chunk;
}

function setPngDpi(input) {
  const bytes = new Uint8Array(input);
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) throw new Error("This PNG file is not valid.");
  let offset = 8;
  let ihdrEnd = 0;

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) throw new Error("This PNG file is incomplete.");
    if (type === "IHDR") ihdrEnd = chunkEnd;
    if (type === "pHYs" && length === 9) {
      const output = bytes.slice();
      writeUint32(output, offset + 8, PIXELS_PER_METER_300_DPI);
      writeUint32(output, offset + 12, PIXELS_PER_METER_300_DPI);
      output[offset + 16] = 1;
      writeUint32(output, offset + 17, crc32(output.slice(offset + 4, offset + 17)));
      return output;
    }
    if (type === "IEND") break;
    offset = chunkEnd;
  }

  if (!ihdrEnd) throw new Error("This PNG is missing its image header.");
  const phys = makePhysChunk();
  const output = new Uint8Array(bytes.length + phys.length);
  output.set(bytes.slice(0, ihdrEnd), 0);
  output.set(phys, ihdrEnd);
  output.set(bytes.slice(ihdrEnd), ihdrEnd + phys.length);
  return output;
}

export function setImageDpi(arrayBuffer, mimeType) {
  if (mimeType === "image/jpeg") return setJpegDpi(arrayBuffer);
  if (mimeType === "image/png") return setPngDpi(arrayBuffer);
  throw new Error("Only JPG and PNG images are supported.");
}
