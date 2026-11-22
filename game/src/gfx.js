// Drawing interface: primitives only. Two backends: canvas + software framebuffer.
// Colors are '#rrggbb' or 'rgba(r,g,b,a)' strings; parse once per call.
export function parseColor(c) {
  if (typeof c !== 'string') return [0, 0, 0, 1];
  if (c[0] === '#') {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  }
  const m = c.match(/[\d.]+/g);
  if (m) return [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1];
  return [0, 0, 0, 1];
}
// Canvas backend (browser).
export function canvasGfx(ctx) {
  let alpha = 1;
  return {
    setAlpha(a) { alpha = a; ctx.globalAlpha = a; },
    getAlpha() { return alpha; },
    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    },
    circle(x, y, r, color) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    },
    poly(points, color) {
      if (points.length < 3) return;
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath(); ctx.fill();
    },
    tri(ax, ay, bx, by, cx, cy, color) { this.poly([[ax, ay], [bx, by], [cx, cy]], color); },
    line(x1, y1, x2, y2, width, color) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    },
  };
}
// Software backend: RGB framebuffer with 2x supersampling handled by caller scaling.
export class SoftGfx {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    this.alpha = 1;
  }
  setAlpha(a) { this.alpha = a; }
  getAlpha() { return this.alpha; }
  _blend(px, py, r, g, b, a) {
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const i = (py * this.w + px) * 3;
    const ia = 1 - a;
    this.buf[i] = Math.round(r * a + this.buf[i] * ia);
    this.buf[i + 1] = Math.round(g * a + this.buf[i + 1] * ia);
    this.buf[i + 2] = Math.round(b * a + this.buf[i + 2] * ia);
  }
  rect(x, y, w, h, color) {
    const [r, g, b, ca] = parseColor(color); const a = ca * this.alpha;
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) this._blend(px, py, r, g, b, a);
  }
  circle(cx, cy, rad, color) {
    const [r, g, b, ca] = parseColor(color); const a = ca * this.alpha;
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(this.w - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(this.h - 1, Math.ceil(cy + rad));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= rad * rad) this._blend(px, py, r, g, b, a);
    }
  }
  poly(points, color) {
    if (points.length < 3) return;
    const [r, g, b, ca] = parseColor(color); const a = ca * this.alpha;
    let minY = 1e9, maxY = -1e9;
    for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let py = y0; py <= y1; py++) {
      const yc = py + 0.5; const xs = [];
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i], p2 = points[(i + 1) % points.length];
        if ((p1[1] <= yc && p2[1] > yc) || (p2[1] <= yc && p1[1] > yc)) {
          xs.push(p1[0] + (yc - p1[1]) / (p2[1] - p1[1]) * (p2[0] - p1[0]));
        }
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(this.w - 1, Math.round(xs[k + 1]));
        for (let px = xa; px <= xb; px++) this._blend(px, py, r, g, b, a);
      }
    }
  }
  tri(ax, ay, bx, by, cx, cy, color) { this.poly([[ax, ay], [bx, by], [cx, cy]], color); }
  line(x1, y1, x2, y2, width, color) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    const rad = width / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rad, color);
    }
  }
}
