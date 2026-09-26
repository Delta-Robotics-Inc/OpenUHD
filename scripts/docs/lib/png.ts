/**
 * Minimal PNG decoder (8-bit, non-interlaced, grey/RGB/RGBA) and image
 * statistics for the verifier's "not blank" check. No dependencies.
 */
import { readFileSync } from "fs";
import { inflateSync } from "zlib";

export interface Png {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

export function decodePng(file: string): Png {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString("ascii", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (depth !== 8 || !channels || interlace) throw new Error(`${file}: unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = out.subarray(y * stride, (y + 1) * stride);
    const up = y ? out.subarray((y - 1) * stride, y * stride) : undefined;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = up ? up[x] : 0;
      const c = up && x >= channels ? up[x - channels] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = v & 255;
    }
  }
  return { width, height, channels, data: out };
}

/** Share of pixels that carry ink (opaque and not near-white), and luminance spread. */
export function inkStats(png: Png): { ink: number; spread: number } {
  const { data, channels, width, height } = png;
  let ink = 0;
  let sum = 0;
  let sum2 = 0;
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 200000));
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * channels;
    const alpha = channels === 4 ? data[o + 3] : channels === 2 ? data[o + 1] : 255;
    const lum = channels >= 3 ? 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2] : data[o];
    const l = alpha < 16 ? 255 : lum;
    if (alpha >= 16 && lum < 235) ink++;
    sum += l;
    sum2 += l * l;
    count++;
  }
  const mean = sum / count;
  return { ink: ink / count, spread: Math.sqrt(Math.max(0, sum2 / count - mean * mean)) };
}
