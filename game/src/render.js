// Rendering: world + HUD + minimap + screens. Primitives + bitmap font only.
import { W, H, WORLD_W, WORLD_H, PAL, BLOCK_W, BLOCK_H, ROAD_W } from './config.js';
import { drawText, drawTextCentered, textWidth } from './font.js';
import { isWater, WATER_X, BEACH_X, districtAt } from './city.js';
import { currentObjective } from './missions.js';
import { clamp } from './random.js';

function hash(n) { let x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
export function cameraFor(w) {
  const p = w.player;
  let cx = clamp(p.x - W / 2, 0, Math.max(0, WORLD_W - W));
  let cy = clamp(p.y - H / 2, 0, Math.max(0, WORLD_H - H));
  if (w.shake > 0) { cx += Math.sin(w.tick * 1.7) * w.shake * 0.4; cy += Math.cos(w.tick * 2.3) * w.shake * 0.4; }
  return { x: cx, y: cy };
}
export function renderWorld(g, w, cam) {
  const t = w.time;
  // ground base: blocks grass/sidewalk base
  g.rect(0, 0, W, H, PAL.grass);
  const x0 = Math.floor(cam.x / 40) * 40, y0 = Math.floor(cam.y / 40) * 40;
  // beach + water
  const bx = BEACH_X - cam.x;
  if (bx < W) g.rect(Math.max(0, bx), 0, W - Math.max(0, bx), H, PAL.sand);
  const wx = WATER_X - cam.x;
  if (wx < W) {
    g.rect(Math.max(0, wx), 0, W - Math.max(0, wx), H, PAL.water);
    // animated shimmer bands
    for (let y = -40; y < H + 40; y += 36) {
      const off = Math.sin(t * 1.4 + y * 0.05) * 14;
      g.setAlpha(0.35); g.rect(Math.max(0, wx) + 20 + off + ((y * 7) % 60), y, 70, 5, PAL.water2); g.setAlpha(1);
    }
  }
  // roads: draw asphalt strips
  for (let x = 0; x <= WORLD_W; x += BLOCK_W) {
    const sx = x - cam.x; if (sx + ROAD_W < 0 || sx > W) continue;
    g.rect(sx, 0, ROAD_W, H, PAL.asphalt);
  }
  for (let y = 0; y <= WORLD_H; y += BLOCK_H) {
    const sy = y - cam.y; if (sy + ROAD_W < 0 || sy > H) continue;
    g.rect(0, sy, W, ROAD_W, PAL.asphalt);
  }
  // sidewalks around blocks (lighter inset)
  for (let bx = 0; bx * BLOCK_W < BEACH_X; bx++) for (let by = 0; by * BLOCK_H < WORLD_H; by++) {
    const sx = bx * BLOCK_W + ROAD_W - 8 - cam.x, sy = by * BLOCK_H + ROAD_W - 8 - cam.y;
    const sw = BLOCK_W - ROAD_W + 16, sh = BLOCK_H - ROAD_W + 16;
    if (sx + sw < 0 || sy + sh < 0 || sx > W || sy > H) continue;
    g.rect(sx, sy, sw, sh, PAL.sidewalk);
    const bd = districtAt(bx * BLOCK_W + BLOCK_W / 2, by * BLOCK_H + BLOCK_H / 2);
    const inner = bd.port ? '#4c525e' : bd.houses ? '#35704e' : bd.name === 'OLD TOWN' ? '#5c5044' : '#4c465e';
    g.rect(sx + 8, sy + 8, sw - 16, sh - 16, inner);
  }
  // lane dashes + crosswalks
  g.setAlpha(0.8);
  for (let x = ROAD_W / 2 - 2; x < BEACH_X; x += BLOCK_W) {
    const sx = x - cam.x; if (sx < -10 || sx > W + 10) continue;
    for (let y = ((cam.y / 44) | 0) * 44; y < cam.y + H + 44; y += 44) g.rect(sx, y - cam.y, 4, 24, PAL.lane);
  }
  for (let y = ROAD_W / 2 - 2; y < WORLD_H; y += BLOCK_H) {
    const sy = y - cam.y; if (sy < -10 || sy > H + 10) continue;
    for (let x = ((cam.x / 44) | 0) * 44; x < cam.x + W + 44; x += 44) g.rect(x - cam.x, sy, 24, 4, PAL.lane);
  }
  g.setAlpha(1);
  // crosswalks at intersections near camera
  for (let ix = 0; ix < BEACH_X; ix += BLOCK_W) for (let iy = 0; iy < WORLD_H; iy += BLOCK_H) {
    const sx = ix - cam.x, sy = iy - cam.y;
    if (sx < -ROAD_W || sy < -ROAD_W || sx > W || sy > H) continue;
    for (let i = 0; i < 4; i++) { g.rect(sx + 8 + i * 22, sy + 2, 12, 8, PAL.crosswalk); g.rect(sx + 8 + i * 22, sy + ROAD_W - 10, 12, 8, PAL.crosswalk); }
  }
  // crates
  for (const c of w.city.crates) {
    if (c.taken) continue;
    const sx = c.x - cam.x, sy = c.y - cam.y; if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue;
    g.rect(sx - 9, sy - 9, 18, 18, '#8a6b3a'); g.rect(sx - 9, sy - 2, 18, 3, '#6b4e28'); g.rect(sx - 2, sy - 9, 3, 18, '#6b4e28');
  }
  // buildings with shadow offset by height
  for (const b of w.city.buildings) {
    const sx = b.x - cam.x, sy = b.y - cam.y;
    if (sx + b.w < -80 || sy + b.h < -80 || sx > W + 80 || sy > H + 80) continue;
    const off = b.hgt * 7;
    g.setAlpha(0.4); g.rect(sx + off, sy + off, b.w, b.h, PAL.black); g.setAlpha(1);
    g.rect(sx - 3, sy - 3, b.w + 6, b.h + 6, PAL.wallEdge);
    g.rect(sx, sy, b.w, b.h, b.roof);
    // roof detail: parapet inner line + rooftop units
    g.rect(sx + 5, sy + 5, b.w - 10, 3, PAL.wallEdge); g.rect(sx + 5, sy + b.h - 8, b.w - 10, 3, PAL.wallEdge);
    g.rect(sx + 8, sy + 10, Math.max(4, b.w * 0.22), Math.max(4, b.h * 0.16), PAL.wallEdge);
    if (b.w > 120) { g.rect(sx + b.w * 0.62, sy + b.h * 0.55, 26, 18, PAL.wallEdge); g.rect(sx + b.w * 0.62 + 4, sy + b.h * 0.55 + 4, 18, 10, b.roof); }
    if (b.kind === 'warehouse') { for (let i = 1; i < 4; i++) g.rect(sx + (b.w / 4) * i, sy, 3, b.h, PAL.wallEdge); }
    if (b.kind === 'house') { g.rect(sx + b.w * 0.3, sy + b.h * 0.3, b.w * 0.4, b.h * 0.4, '#3a2f28'); }
    // lit windows grid on roof edge (top-down facade hint)
    if (b.kind === 'tower') {
      const seed = b.seed || 1;
      const cols = Math.max(2, Math.floor(b.w / 30)), rows = Math.max(2, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const lit = hash(seed + i * 31 + j * 57) > 0.52;
        const flick = lit && hash(seed + i + j * 3) > 0.9 ? Math.sin(t * 6 + seed) > 0 : lit;
        g.rect(sx + 10 + i * 30, sy + 12 + j * 30, 11, 8, flick ? PAL.windowLit : PAL.windowDark);
      }
    }
    // neon sign
    if (b.sign) {
      const flicker = Math.sin(t * 9 + b.x) > -0.92;
      const col = flicker ? (b.signCol || PAL.neonPink) : PAL.windowDark;
      const sc = 1;
      const tw = textWidth(b.sign, sc);
      if (tw < b.w - 6) {
        g.setAlpha(0.85); g.rect(sx + 3, sy + b.h - 16, tw + 8, 13, PAL.black); g.setAlpha(1);
        drawText(g, b.sign, sx + 7, sy + b.h - 13, sc, col);
      }
    }
  }
  // props
  for (const pr of w.city.props) {
    const sx = pr.x - cam.x, sy = pr.y - cam.y;
    if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;
    if (pr.type === 'palm') {
      g.rect(sx - 2, sy - 2, 5, 5, '#6b4e28');
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + pr.x * 0.01; g.line(sx, sy, sx + Math.cos(a) * 15, sy + Math.sin(a) * 15, 3, '#2e8b57'); }
      g.circle(sx, sy, 4, '#3aa76d');
    } else if (pr.type === 'lamp') {
      g.circle(sx, sy, 3, '#333');
      g.setAlpha(0.22); g.circle(sx, sy, 20, PAL.windowLit); g.setAlpha(1);
      g.circle(sx, sy, 3, PAL.windowLit);
    } else if (pr.type === 'crane') {
      g.rect(sx - 4, sy - 40, 8, 80, '#c0392b'); g.rect(sx - 4, sy - 40, 90, 7, '#c0392b'); g.line(sx + 70, sy - 33, sx + 70, sy - 4, 2, '#888'); g.rect(sx + 62, sy - 6, 16, 12, '#f39c12');
    }
  }
  // landmark pads
  drawMarkerPad(g, w, cam, w.city.landmarks.garage, '#3dff7a', 'G');
  drawMarkerPad(g, w, cam, w.city.landmarks.safehouse, '#22e6ff', 'H');
  drawMarkerPad(g, w, cam, w.city.landmarks.police, '#5b7fff', 'PD');
  drawMarkerPad(g, w, cam, w.city.landmarks.hospital, '#ffffff', '+');
  // pickups
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    const sx = pk.x - cam.x, sy = pk.y - cam.y + Math.sin(t * 3 + pk.x) * 3;
    if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
    const col = pk.kind === 'ammo' ? PAL.neonGold : pk.kind === 'health' ? '#ff5b5b' : PAL.cash;
    g.rect(sx - 7, sy - 7, 14, 14, PAL.black); g.rect(sx - 5, sy - 5, 10, 10, col);
    drawText(g, pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : '$', sx - 2, sy - 3, 1, PAL.black);
  }
  // objective marker (pulsing pillar)
  const obj = currentObjective(w);
  if (obj.x != null) {
    const sx = obj.x - cam.x, sy = obj.y - cam.y;
    const pulse = 14 + Math.sin(t * 4) * 4;
    g.setAlpha(0.3); g.circle(sx, sy, pulse + 12, PAL.marker); g.setAlpha(1);
    g.circle(sx, sy, 10, PAL.marker);
    drawText(g, '!', sx - 2, sy - 4, 1, PAL.black);
    // off-screen direction arrow
    if (sx < 30 || sx > W - 30 || sy < 30 || sy > H - 30) {
      const cx = clamp(sx, 40, W - 40), cy = clamp(sy, 40, H - 40);
      const a = Math.atan2(sy - cy, sx - cx);
      g.tri(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, cx + Math.cos(a + 2.5) * 11, cy + Math.sin(a + 2.5) * 11, cx + Math.cos(a - 2.5) * 11, cy + Math.sin(a - 2.5) * 11, PAL.marker);
    }
  }
  // taxi marker
  if (w.taxi && w.player.car) {
    const tx = (w.taxi.phase === 'pickup' ? w.taxi.x : w.taxi.destX) - cam.x, ty = (w.taxi.phase === 'pickup' ? w.taxi.y : w.taxi.destY) - cam.y;
    g.circle(tx, ty, 9, PAL.neonCyan); drawText(g, 'T', tx - 2, ty - 3, 1, PAL.black);
  }
  // cars
  for (const c of w.cars) drawCar(g, c, c.x - cam.x, c.y - cam.y, t);
  for (const c of w.police) drawCar(g, c, c.x - cam.x, c.y - cam.y, t);
  // peds
  for (const ped of w.peds) drawPed(g, ped, ped.x - cam.x, ped.y - cam.y);
  // player
  const p = w.player;
  if (!p.car) drawPed(g, { x: p.x, y: p.y, angle: p.angle, skin: '#e8b08a', shirt: '#ff2e88', state: 'walk', rival: false, isPlayer: true }, p.x - cam.x, p.y - cam.y, true);
  else {
    // headlight cones
    const c = p.car, sx = c.x - cam.x, sy = c.y - cam.y;
    g.setAlpha(0.13);
    g.poly([[sx + Math.cos(c.angle) * 20, sy + Math.sin(c.angle) * 20], [sx + Math.cos(c.angle - 0.22) * 130, sy + Math.sin(c.angle - 0.22) * 130], [sx + Math.cos(c.angle + 0.22) * 130, sy + Math.sin(c.angle + 0.22) * 130]], '#fff6b0');
    g.setAlpha(1);
  }
  // bullets
  for (const b of w.bullets) { g.rect(b.x - cam.x - 3, b.y - cam.y - 1, 6, 2, '#ffe98a'); }
  // particles
  for (const q of w.particles) { g.setAlpha(clamp(q.life / q.max, 0, 1)); g.rect(q.x - cam.x - q.size / 2, q.y - cam.y - q.size / 2, q.size, q.size, q.color); }
  g.setAlpha(1);
  // bust meter ring hint handled in HUD
}
function drawMarkerPad(g, w, cam, lm, color, label) {
  const sx = lm.x - cam.x, sy = lm.y - cam.y;
  if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) return;
  g.setAlpha(0.3); g.rect(sx - 34, sy - 24, 68, 48, color); g.setAlpha(1);
  g.rect(sx - 34, sy - 24, 68, 3, color); g.rect(sx - 34, sy + 21, 68, 3, color);
  drawText(g, label, sx - textWidth(label, 1) / 2, sy - 4, 1, color);
}
function drawCar(g, c, sx, sy, t) {
  if (sx < -70 || sy < -70 || sx > W + 70 || sy > H + 70) return;
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
  const pt = (lx, ly) => [sx + lx * ca - ly * sa, sy + lx * sa + ly * ca];
  // shadow + body
  g.setAlpha(0.35); g.poly([pt(24, -10), pt(24, 13), pt(-24, 13), pt(-24, -10)], PAL.black); g.setAlpha(1);
  const body = c.police ? PAL.police : c.color;
  g.poly([pt(22, -11), pt(22, 11), pt(-22, 11), pt(-22, -11)], body);
  if (c.police) { g.poly([pt(8, -11), pt(8, 11), pt(-8, 11), pt(-8, -11)], PAL.policeStripe); }
  if (c.isGold) { g.poly([pt(22, -11), pt(22, 11), pt(-22, 11), pt(-22, -11)], '#ffd700'); }
  // cabin / windshield
  g.poly([pt(6, -8), pt(6, 8), pt(-8, 8), pt(-8, -8)], '#1b2a3a');
  g.poly([pt(12, -7), pt(12, 7), pt(7, 7), pt(7, -7)], '#7fd4e8');
  // wheels
  for (const [lx, ly] of [[14, -12], [14, 12], [-14, -12], [-14, 12]]) { const [wx2, wy2] = pt(lx, ly); g.rect(wx2 - 4, wy2 - 2, 8, 4, '#111'); }
  // lights
  const [h1x, h1y] = pt(23, -7), [h2x, h2y] = pt(23, 7);
  g.circle(h1x, h1y, 2.5, '#fff6b0'); g.circle(h2x, h2y, 2.5, '#fff6b0');
  const [t1x, t1y] = pt(-23, -7), [t2x, t2y] = pt(-23, 7);
  g.circle(t1x, t1y, 2.5, '#ff2222'); g.circle(t2x, t2y, 2.5, '#ff2222');
  if (c.police) {
    const flash = Math.sin(t * 10) > 0;
    g.circle(sx, sy, 4, flash ? '#ff2222' : '#2266ff');
    g.setAlpha(0.18); g.circle(sx, sy, 26, flash ? '#ff2222' : '#2266ff'); g.setAlpha(1);
  }
  if (c.health < 100 && !c.police) { // damage bar
    g.rect(sx - 18, sy - 22, 36, 4, '#222'); g.rect(sx - 18, sy - 22, 36 * clamp(c.health / 100, 0, 1), 4, c.health > 40 ? PAL.health : PAL.danger);
  }
}
function drawPed(g, ped, sx, sy, isPlayer) {
  if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) return;
  if (ped.state === 'down' || ped.state === 'dead') {
    g.rect(sx - 10, sy - 4, 20, 8, ped.shirt || '#888');
    g.circle(sx + 11, sy, 4, ped.skin || '#e8b08a');
    if (ped.state === 'dead') { g.setAlpha(0.5); g.rect(sx - 12, sy - 8, 26, 3, '#7a1020'); g.setAlpha(1); }
    return;
  }
  g.setAlpha(0.3); g.circle(sx, sy + 7, 7, PAL.black); g.setAlpha(1);
  const walk = Math.sin((ped.x + ped.y) * 0.12) * 2;
  g.rect(sx - 4, sy + 2, 3, 7 + walk, '#26304a'); g.rect(sx + 2, sy + 2, 3, 7 - walk, '#26304a');
  g.rect(sx - 5, sy - 5, 11, 9, ped.shirt || '#888');
  g.circle(sx, sy - 8, 5, ped.skin || '#e8b08a');
  if (ped.rival) { g.rect(sx - 5, sy - 15, 11, 3, '#ff2222'); }
  if (isPlayer) { g.tri(sx, sy - 20, sx - 5, sy - 27, sx + 5, sy - 27, PAL.neonPink); }
}
export function renderHUD(g, w) {
  const p = w.player;
  // top-left panel
  g.setAlpha(0.78); g.rect(12, 12, 252, 62, PAL.hudBg); g.setAlpha(1);
  drawText(g, '$' + p.cash, 22, 20, 3, PAL.cash);
  drawText(g, 'RESPECT ' + p.respect, 22, 48, 2, PAL.white);
  const d = districtAt(p.x, p.y);
  drawText(g, d.name, 22, 82, 1, PAL.grey);
  // wanted stars top-right
  for (let i = 0; i < 5; i++) {
    const x = W - 34 - i * 30, y = 18;
    drawStar(g, x, y, 11, i < w.wanted ? PAL.star : '#3a3550');
  }
  if (w.wanted > 0) drawText(g, 'WANTED', W - 34 - 4 * 30 - textWidth('WANTED', 1) / 2 - 22, 38, 1, PAL.danger);
  // objective top-center
  const obj = currentObjective(w);
  let objText = obj.text;
  if (obj.timer != null) objText += '  ' + Math.max(0, Math.ceil(obj.timer)) + 'S';
  const tw = textWidth(objText, 2);
  g.setAlpha(0.78); g.rect(W / 2 - tw / 2 - 12, 12, tw + 24, 30, PAL.hudBg); g.setAlpha(1);
  drawTextCentered(g, objText, W / 2, 19, 2, PAL.marker);
  // bottom-left health + weapon
  g.setAlpha(0.78); g.rect(12, H - 64, 240, 52, PAL.hudBg); g.setAlpha(1);
  g.rect(22, H - 54, 180, 12, '#2b2740');
  g.rect(22, H - 54, 180 * clamp(p.health / 100, 0, 1), 12, p.health > 30 ? PAL.health : PAL.healthLow);
  drawText(g, 'HP ' + Math.ceil(p.health), 22, H - 38, 1, PAL.white);
  drawText(g, p.hasGun ? 'PISTOL ' + p.ammo : 'FISTS', 120, H - 38, 1, p.hasGun ? PAL.neonGold : PAL.grey);
  if (p.car) drawText(g, 'CAR ' + Math.ceil(p.car.health) + '%', 22, H - 24, 1, PAL.grey);
  // speedometer
  if (p.car) {
    const spd = Math.round(Math.abs(p.car.speed) * 0.36);
    g.setAlpha(0.78); g.rect(W - 216, H - 196, 204, 34, PAL.hudBg); g.setAlpha(1);
    drawText(g, spd + '', W - 206, H - 190, 3, PAL.white);
    drawText(g, 'KM/H', W - 206 + textWidth(spd + '', 3) + 6, H - 178, 1, PAL.grey);
  }
  // interaction prompt
  const prompt = interactionPrompt(w);
  if (prompt) {
    const pw = textWidth(prompt, 2);
    g.setAlpha(0.85); g.rect(W / 2 - pw / 2 - 10, H - 120, pw + 20, 28, PAL.hudBg); g.setAlpha(1);
    drawTextCentered(g, prompt, W / 2, H - 113, 2, PAL.neonCyan);
  }
  // bust meter
  if (w.bustMeter > 1) {
    drawTextCentered(g, 'BUST RISK', W / 2, H - 190, 2, PAL.danger);
    g.rect(W / 2 - 90, H - 168, 180, 12, '#2b2740'); g.rect(W / 2 - 90, H - 168, 180 * w.bustMeter / 100, 12, PAL.danger);
  }
  // garage hint
  const gl = w.city.landmarks.garage;
  if (p.car && w.wanted > 0) {
    const fee = 100 * w.wanted;
    drawText(g, 'GLOSS GARAGE RESPRAY $' + fee, 22, 98, 1, PAL.neonGreen);
  }
  // notification
  if (w.messageT > 0 && w.message) drawTextCentered(g, w.message, W / 2, 56, 2, PAL.cash);
  // banner
  if (w.bannerT > 0 && w.banner) {
    g.setAlpha(0.88); g.rect(0, H / 2 - 70, W, 110, PAL.bannerBg); g.setAlpha(1);
    g.rect(0, H / 2 - 70, W, 4, PAL.neonPink); g.rect(0, H / 2 + 36, W, 4, PAL.neonCyan);
    drawTextCentered(g, w.banner.text, W / 2, H / 2 - 52, 4, PAL.marker);
    if (w.banner.sub) drawTextCentered(g, w.banner.sub, W / 2, H / 2 - 8, 2, PAL.white);
  }
  // dialogue at bottom
  if (w.dialogueT > 0 && w.dialogue) {
    g.setAlpha(0.9); g.rect(90, H - 108, W - 180, 40, PAL.bannerBg); g.setAlpha(1);
    g.rect(90, H - 108, 5, 40, PAL.neonPink);
    drawText(g, w.dialogue.who + ':', 106, H - 100, 1, PAL.neonCyan);
    drawText(g, wrap(w.dialogue.text, 62), 106, H - 86, 2, PAL.white);
  }
  renderMinimap(g, w);
}
function wrap(s, n) { return s.length > n ? s.slice(0, n) : s; }
function drawStar(g, cx, cy, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  g.poly(pts, color);
}
export function interactionPrompt(w) {
  const p = w.player;
  if (p.car) {
    const gpos = w.city.landmarks.garage;
    if (w.wanted > 0 && Math.hypot(p.car.x - gpos.x, p.car.y - gpos.y) < 90) return 'E - RESPRAY $' + (100 * w.wanted);
    return 'E - EXIT CAR';
  }
  for (const c of w.cars) if (Math.hypot(c.x - p.x, c.y - p.y) < 52) return 'E - ENTER CAR';
  for (const c of w.police) if (Math.hypot(c.x - p.x, c.y - p.y) < 52) return 'E - ENTER CAR';
  return '';
}
export function renderMinimap(g, w) {
  const mw = 196, mh = 140, mx = W - mw - 12, my = H - mh - 12;
  g.setAlpha(0.85); g.rect(mx - 3, my - 3, mw + 6, mh + 6, PAL.black); g.setAlpha(1);
  g.rect(mx, my, mw, mh, '#243447');
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  // water
  g.rect(mx + BEACH_X * sx, my, (WORLD_W - BEACH_X) * sx, mh, PAL.water);
  g.rect(mx + BEACH_X * sx, my, (WATER_X - BEACH_X) * sx, mh, PAL.sand);
  // roads
  for (let x = 0; x < BEACH_X; x += BLOCK_W) g.rect(mx + x * sx, my, Math.max(1, ROAD_W * sx), mh, '#5a5470');
  for (let y = 0; y < WORLD_H; y += BLOCK_H) g.rect(mx, my + y * sy, BEACH_X * sx, Math.max(1, ROAD_W * sy), '#5a5470');
  // landmarks
  const L = w.city.landmarks;
  const dot = (x, y, c, s) => g.rect(mx + x * sx - s / 2, my + y * sy - s / 2, s, s, c);
  dot(L.garage.x, L.garage.y, '#3dff7a', 6); dot(L.safehouse.x, L.safehouse.y, '#22e6ff', 6);
  dot(L.police.x, L.police.y, '#5b7fff', 5);
  const obj = currentObjective(w);
  if (obj.x != null && Math.sin(w.time * 5) > -0.4) dot(obj.x, obj.y, PAL.marker, 8);
  for (const c of w.police) dot(c.x, c.y, '#ff3b3b', 5);
  // player arrow
  const p = w.player, px = mx + p.x * sx, py = my + p.y * sy;
  const a = p.car ? p.car.angle : p.angle;
  g.tri(px + Math.cos(a) * 8, py + Math.sin(a) * 8, px + Math.cos(a + 2.4) * 6, py + Math.sin(a + 2.4) * 6, px + Math.cos(a - 2.4) * 6, py + Math.sin(a - 2.4) * 6, PAL.neonPink);
  drawText(g, 'PALMERA BAY', mx + 4, my + mh - 12, 1, '#8fa3bf');
}
export function renderTitle(g, w, cam, hasSave) {
  renderWorld(g, w, cam);
  g.setAlpha(0.45); g.rect(0, 0, W, H, '#120826'); g.setAlpha(1);
  // skyline vista strip handled by world behind; title
  drawTextCentered(g, 'NEON PALMS', W / 2, 120, 9, PAL.neonPink);
  drawTextCentered(g, 'NEON PALMS', W / 2 + 3, 123, 9, PAL.neonCyan);
  drawTextCentered(g, 'PALMERA BAY', W / 2, 210, 4, PAL.marker);
  drawTextCentered(g, 'AN OPEN-WORLD CRIME STORY IN A NEON COASTAL CITY', W / 2, 252, 2, PAL.white);
  drawTextCentered(g, 'ENTER - NEW GAME', W / 2, 330, 3, PAL.cash);
  if (hasSave) drawTextCentered(g, 'C - CONTINUE', W / 2, 372, 3, PAL.neonCyan);
  const lines = ['WASD / ARROWS - MOVE + DRIVE', 'SHIFT - RUN    E - ENTER / EXIT CAR', 'SPACE - PUNCH / FIRE    P / ESC - PAUSE', 'STEAL CARS. RUN JOBS. DODGE THE LAW.'];
  lines.forEach((s, i) => drawTextCentered(g, s, W / 2, 440 + i * 24, 2, PAL.grey));
}
export function renderPause(g, w) {
  g.setAlpha(0.7); g.rect(0, 0, W, H, PAL.black); g.setAlpha(1);
  drawTextCentered(g, 'PAUSED', W / 2, 200, 6, PAL.white);
  drawTextCentered(g, 'P / ESC - RESUME', W / 2, 300, 2, PAL.cash);
  drawTextCentered(g, 'S - SAVE GAME', W / 2, 334, 2, PAL.neonCyan);
  drawTextCentered(g, 'R - RESTART STORY', W / 2, 368, 2, PAL.neonGold);
}
export function renderEndOverlay(g, w, kind) {
  g.setAlpha(0.72); g.rect(0, 0, W, H, kind === 'busted' ? '#0a1440' : '#400a10'); g.setAlpha(1);
  drawTextCentered(g, kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, 260, 9, kind === 'busted' ? '#5b7fff' : PAL.danger);
  drawTextCentered(g, kind === 'busted' ? 'RELEASED FROM PALMERA PD' : 'PATCHED UP AT ST LUCIA HOSPITAL', W / 2, 360, 2, PAL.white);
  drawTextCentered(g, 'PRESS ENTER TO CONTINUE', W / 2, 410, 2, PAL.marker);
}
