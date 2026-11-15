/**
 * Pure TypeScript GIF89a animated image encoder for HTML5 Canvas frames.
 * Uses a 256-color (6x6x6 RGB cube + 40 grayscale ramp) global color table
 * and standard LZW compression with Netscape 2.0 infinite loop extension.
 */

function buildGlobalPalette(): { palette: Uint8Array; lut: Uint8Array } {
  const palette = new Uint8Array(256 * 3);
  let idx = 0;

  // 216 RGB cube colors (6 x 6 x 6)
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx * 3] = Math.round((r * 255) / 5);
        palette[idx * 3 + 1] = Math.round((g * 255) / 5);
        palette[idx * 3 + 2] = Math.round((b * 255) / 5);
        idx++;
      }
    }
  }

  // Remaining 40 slots: fine grayscale ramp for crisp anti-aliased text
  for (let i = 0; i < 40; i++) {
    const v = Math.round((i * 255) / 39);
    palette[idx * 3] = v;
    palette[idx * 3 + 1] = v;
    palette[idx * 3 + 2] = v;
    idx++;
  }

  // Build 15-bit RGB555 lookup table (32 * 32 * 32 = 32768 entries) for O(1) quantization
  const lut = new Uint8Array(32 * 32 * 32);
  for (let r5 = 0; r5 < 32; r5++) {
    const r = (r5 * 255) / 31;
    for (let g5 = 0; g5 < 32; g5++) {
      const g = (g5 * 255) / 31;
      for (let b5 = 0; b5 < 32; b5++) {
        const b = (b5 * 255) / 31;
        let bestIdx = 0;
        let bestDist = Infinity;

        // Check RGB cube closest candidate neighborhood first + grayscale
        const ri = Math.round((r / 255) * 5);
        const gi = Math.round((g / 255) * 5);
        const bi = Math.round((b / 255) * 5);
        const cubeIdx = ri * 36 + gi * 6 + bi;
        const dr = r - palette[cubeIdx * 3];
        const dg = g - palette[cubeIdx * 3 + 1];
        const db = b - palette[cubeIdx * 3 + 2];
        bestIdx = cubeIdx;
        bestDist = dr * dr + dg * dg + db * db;

        // Check grayscale ramp (indices 216..255) for near-neutral pixels
        for (let k = 216; k < 256; k++) {
          const pr = palette[k * 3];
          const pg = palette[k * 3 + 1];
          const pb = palette[k * 3 + 2];
          const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = k;
          }
        }

        lut[(r5 << 10) | (g5 << 5) | b5] = bestIdx;
      }
    }
  }

  return { palette, lut };
}

let cachedPaletteData: { palette: Uint8Array; lut: Uint8Array } | null = null;

function getPaletteData() {
  if (!cachedPaletteData) {
    cachedPaletteData = buildGlobalPalette();
  }
  return cachedPaletteData;
}

function quantizeRgba(rgba: Uint8ClampedArray, lut: Uint8Array): Uint8Array {
  const pixelCount = rgba.length >> 2;
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const p = i << 2;
    const key = ((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3);
    indices[i] = lut[key];
  }
  return indices;
}

function lzwEncode(indices: Uint8Array, minCodeSize = 8): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const outBytes: number[] = [];

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let bitBuffer = 0;
  let bitCount = 0;

  // Flat hash table: 4096 max entries; key = (prefix << 8) | suffix
  const tableKeys = new Int32Array(8192);
  const tableVals = new Int16Array(8192);
  const resetTable = () => {
    tableKeys.fill(-1);
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  const writeBits = (code: number, bits: number) => {
    bitBuffer |= code << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      outBytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  resetTable();
  writeBits(clearCode, codeSize);

  if (indices.length === 0) {
    writeBits(eoiCode, codeSize);
    if (bitCount > 0) outBytes.push(bitBuffer & 0xff);
    return new Uint8Array(outBytes);
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const suffix = indices[i];
    const key = (prefix << 8) | suffix;
    let slot = ((key * 2654435761) >>> 19) & 8191;
    let found = -1;

    while (tableKeys[slot] !== -1) {
      if (tableKeys[slot] === key) {
        found = tableVals[slot];
        break;
      }
      slot = (slot + 1) & 8191;
    }

    if (found !== -1) {
      prefix = found;
    } else {
      writeBits(prefix, codeSize);
      if (nextCode < 4096) {
        tableKeys[slot] = key;
        tableVals[slot] = nextCode;
        if (nextCode === 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
        nextCode++;
      } else {
        writeBits(clearCode, codeSize);
        resetTable();
      }
      prefix = suffix;
    }
  }

  writeBits(prefix, codeSize);
  writeBits(eoiCode, codeSize);
  if (bitCount > 0) {
    outBytes.push(bitBuffer & 0xff);
  }

  return new Uint8Array(outBytes);
}

export interface AnimatedGifFrameInput {
  rgba: Uint8ClampedArray;
  delayMs: number;
}

export function encodeAnimatedGif(
  width: number,
  height: number,
  frames: AnimatedGifFrameInput[]
): Blob {
  const { palette, lut } = getPaletteData();
  const chunks: Uint8Array[] = [];

  const pushBytes = (bytes: number[]) => {
    chunks.push(new Uint8Array(bytes));
  };

  // Header "GIF89a"
  pushBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

  // Logical Screen Descriptor (width, height, packed=0xF7 -> GCT 256 colors)
  pushBytes([
    width & 0xff,
    (width >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
    0xf7,
    0x00,
    0x00,
  ]);

  // Global Color Table (256 * 3 bytes)
  chunks.push(palette);

  // Netscape 2.0 Application Extension for infinite looping
  pushBytes([
    0x21,
    0xff,
    0x0b,
    0x4e,
    0x45,
    0x54,
    0x53,
    0x43,
    0x41,
    0x50,
    0x45,
    0x32,
    0x2e,
    0x30,
    0x03,
    0x01,
    0x00,
    0x00,
    0x00,
  ]);

  for (const frame of frames) {
    const delayCs = Math.max(2, Math.round(frame.delayMs / 10));
    // Graphic Control Extension
    pushBytes([
      0x21,
      0xf9,
      0x04,
      0x00,
      delayCs & 0xff,
      (delayCs >> 8) & 0xff,
      0x00,
      0x00,
    ]);

    // Image Descriptor (full frame)
    pushBytes([
      0x2c,
      0x00,
      0x00,
      0x00,
      0x00,
      width & 0xff,
      (width >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
      0x00,
    ]);

    // LZW minimum code size = 8
    pushBytes([0x08]);

    const indexed = quantizeRgba(frame.rgba, lut);
    const compressed = lzwEncode(indexed, 8);

    // Sub-blocks (max 255 bytes each)
    let offset = 0;
    while (offset < compressed.length) {
      const len = Math.min(255, compressed.length - offset);
      pushBytes([len]);
      chunks.push(compressed.subarray(offset, offset + len));
      offset += len;
    }
    pushBytes([0x00]); // Block terminator
  }

  // GIF Trailer
  pushBytes([0x3b]);

  return new Blob(chunks as BlobPart[], { type: 'image/gif' });
}
