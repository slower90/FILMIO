"use strict";

const fs = require("fs");

const MAX_INPUT_SIZE = 512 * 1024;

function ensureInput(input) {
  if (
    !input ||
    typeof input.length !== "number" ||
    typeof input.toString !== "function"
  ) {
    throw new TypeError("invalid invocation. input should be a Uint8Array");
  }
  if (input.length === 0 || input.length > MAX_INPUT_SIZE) {
    throw new TypeError("invalid image input size");
  }
  return input;
}

function readUInt16BE(input, offset) {
  return input[offset] * 256 + input[offset + 1];
}

function readUInt32BE(input, offset) {
  return (
    input[offset] * 0x1000000 +
    input[offset + 1] * 0x10000 +
    input[offset + 2] * 0x100 +
    input[offset + 3]
  );
}

function readUInt32LE(input, offset) {
  return (
    input[offset] +
    input[offset + 1] * 0x100 +
    input[offset + 2] * 0x10000 +
    input[offset + 3] * 0x1000000
  );
}

function readUInt16LE(input, offset) {
  return input[offset] + input[offset + 1] * 256;
}

function dimensions(input) {
  if (
    input.length >= 24 &&
    input[0] === 0x89 &&
    input[1] === 0x50 &&
    input[2] === 0x4e &&
    input[3] === 0x47
  ) {
    return { width: readUInt32BE(input, 16), height: readUInt32BE(input, 20) };
  }

  if (
    input.length >= 10 &&
    input[0] === 0x47 &&
    input[1] === 0x49 &&
    input[2] === 0x46
  ) {
    return { width: readUInt16LE(input, 6), height: readUInt16LE(input, 8) };
  }

  if (
    input.length >= 30 &&
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP"
  ) {
    const kind = input.toString("ascii", 12, 16);
    if (kind === "VP8X") {
      return {
        width: 1 + input[24] + input[25] * 256 + input[26] * 65536,
        height: 1 + input[27] + input[28] * 256 + input[29] * 65536,
      };
    }
    if (kind === "VP8 " && input.length >= 30) {
      return { width: readUInt16LE(input, 26), height: readUInt16LE(input, 28) };
    }
    if (kind === "VP8L" && input.length >= 25) {
      return {
        width: 1 + ((input[21] | (input[22] << 8)) & 0x3fff),
        height:
          1 +
          (((input[22] >> 6) | (input[23] << 2) | (input[24] << 10)) &
            0x3fff),
      };
    }
  }

  if (input.length >= 26 && input.toString("ascii", 0, 2) === "BM") {
    return {
      width: Math.abs(readUInt32LE(input, 18)),
      height: Math.abs(readUInt32LE(input, 22)),
    };
  }

  if (
    input.length >= 5 &&
    input.toString("ascii", 0, 5).toLowerCase() === "<?xml"
  ) {
    return svgDimensions(input);
  }
  if (
    input.length >= 4 &&
    input.toString("ascii", 0, 4).toLowerCase() === "<svg"
  ) {
    return svgDimensions(input);
  }

  if (input.length >= 24 && input[0] === 0xff && input[1] === 0xd8) {
    return jpegDimensions(input);
  }

  throw new TypeError("unsupported or malformed image");
}

function jpegDimensions(input) {
  let offset = 2;
  while (offset + 9 < input.length) {
    if (input[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = input[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = readUInt16BE(input, offset + 2);
    if (length < 2 || offset + 2 + length > input.length) {
      throw new TypeError("malformed JPEG");
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: readUInt16BE(input, offset + 5),
        width: readUInt16BE(input, offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new TypeError("unsupported JPEG");
}

function svgDimensions(input) {
  const text = input.toString("utf8", 0, Math.min(input.length, 32 * 1024));
  const width = text.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i);
  const height = text.match(/\bheight\s*=\s*["']\s*([\d.]+)/i);
  const viewBox = text.match(
    /\bviewBox\s*=\s*["'][^"']*\s+([\d.]+)\s+([\d.]+)/i,
  );
  if (width && height) {
    return { width: Number(width[1]), height: Number(height[1]) };
  }
  if (viewBox) {
    return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  }
  throw new TypeError("unsupported SVG");
}

function imageSize(input) {
  if (typeof input === "string") {
    const stat = fs.statSync(input);
    if (stat.size <= 0 || stat.size > MAX_INPUT_SIZE) {
      throw new TypeError("invalid image input size");
    }
    input = fs.readFileSync(input);
  }
  return dimensions(ensureInput(input));
}

module.exports = imageSize;
module.exports.default = imageSize;
module.exports.imageSize = imageSize;