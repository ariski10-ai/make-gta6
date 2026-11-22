// Software screenshot renderer for Neon Palms. Node standard library only.
// Renders each scene from shots.json at 1280x720 with 2x supersampling, writes a PNG
// via a hand-rolled encoder (node:zlib), then converts to JPEG with ffmpeg.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { SoftGfx } from '../game/src/gfx.js';
import { stageShot } from '../game/src/shots.js';
import { renderWorld, renderHUD, renderTitle } from '../game/src/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const SS = 2, W = 1280, H = 720;

// Scale wrapper: game draws in 1280x720 space; framebuffer is 2x.
function scaledGfx(inner, s) {
  const m = (fn) => (...a) => fn(...a);
  return {
    setAlpha: (a) => inner.setAlpha(a), getAlpha: () => inner.getAlpha(),
    rect: (x, y, w, h, c) => inner.rect(x * s, y * s, w * s, h * s, c),
    circle: (x, y, r, c) => inner.circle(x * s, y * s, r * s, c),
    poly: (pts, c) => inner.poly(pts.map(p => [p[0] * s, p[1] * s]), c),
    tri: (a, b, c2, d, e, f, col) => inner.tri(a * s, b * s, c2 * s, d * s, e * s, f * s, col),
    line: (x1, y1, x2, y2, w, c) => inner.line(x1 * s, y1 * s, x2 * s, y2 * s, w * s, c),
  };
}
function downsample(src, sw, sh, s) {
  const dw = sw / s, dh = sh / s, out = new Uint8Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const idx = ((y * s + j) * sw + (x * s + i)) * 3;
      r += src[idx]; g += src[idx + 1]; b += src[idx + 2];
    }
    const n = s * s, o = (y * dw + x) * 3;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return out;
}
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(pixels, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
mkdirSync('/tmp/neon-shots', { recursive: true });
mkdirSync(join(root, 'screenshots'), { recursive: true });
let usedPngFallback = false;
for (const shot of shots) {
  const q = new URLSearchParams(shot.query.replace(/^\?/, ''));
  const name = q.get('shot'), seed = parseInt(q.get('seed') || '7', 10) || 7;
  const staged = stageShot(name, seed);
  const soft = new SoftGfx(W * SS, H * SS);
  const g = scaledGfx(soft, SS);
  if (staged.screen === 'title') renderTitle(g, staged.world, staged.cam, false);
  else { renderWorld(g, staged.world, staged.cam); renderHUD(g, staged.world); }
  const px = downsample(soft.buf, W * SS, H * SS, SS);
  const png = encodePNG(px, W, H);
  const pngPath = join('/tmp/neon-shots', shot.name.replace(/\.jpg$/, '.png'));
  writeFileSync(pngPath, png);
  const outPath = join(root, 'screenshots', shot.name);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-q:v', '4', outPath], { stdio: 'pipe' });
    console.log('wrote', outPath);
  } catch (e) {
    usedPngFallback = true;
    const alt = outPath.replace(/\.jpg$/, '.png');
    writeFileSync(alt, png);
    console.log('ffmpeg failed; kept PNG at', alt);
  }
}
if (usedPngFallback) console.log('NOTE: PNG fallback used for at least one shot');
