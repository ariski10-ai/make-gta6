// Palmera Bay city generation: deterministic from seed.
import { WORLD_W, WORLD_H, BLOCK_W, BLOCK_H, ROAD_W, DISTRICTS, PAL } from './config.js';
import { makeRng } from './random.js';

export const WATER_X = 4080; // water east of this
export const BEACH_X = 3920;

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[0];
}
export function isRoadX(x) { const m = ((x % BLOCK_W) + BLOCK_W) % BLOCK_W; return m < ROAD_W; }
export function isRoadY(y) { const m = ((y % BLOCK_H) + BLOCK_H) % BLOCK_H; return m < ROAD_W; }
export function isRoad(x, y) { return x < BEACH_X && (isRoadX(x) || isRoadY(y)); }
export function isWater(x, y) { return x >= WATER_X; }
export function isBeach(x, y) { return x >= BEACH_X && x < WATER_X; }
// Road centre lines for AI: vertical avenues at x = k*BLOCK_W + ROAD_W/2, horizontal similar.
export function avenueXs() { const a = []; for (let x = ROAD_W / 2; x < BEACH_X; x += BLOCK_W) a.push(x); return a; }
export function streetYs() { const a = []; for (let y = ROAD_W / 2; y < WORLD_H; y += BLOCK_H) a.push(y); return a; }

const SIGNS = ['CLUB VELVET', 'HOTEL SOL', 'BAR LUNA', 'CASINO', 'PIZZA MIA', 'TACO RIO', 'DISCO', 'RAMEN', 'GYM 24H', 'LIQUOR', 'PHARMACY', 'DINER', 'TATTOO', 'KARAOKE', 'MALL', 'CINEMA'];

export function generateCity(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [], props = [], crates = [];
  const cols = Math.floor(BEACH_X / BLOCK_W), rows = Math.floor(WORLD_H / BLOCK_H);
  for (let bx = 0; bx < cols; bx++) for (let by = 0; by < rows; by++) {
    const x0 = bx * BLOCK_W + ROAD_W, y0 = by * BLOCK_H + ROAD_W;
    const bw = BLOCK_W - ROAD_W, bh = BLOCK_H - ROAD_W;
    const cx = x0 + bw / 2, cy = y0 + bh / 2;
    const d = districtAt(cx, cy);
    if (d.port) {
      // warehouses: 2 big sheds per block
      for (let i = 0; i < 2; i++) {
        const w = bw * 0.42, h = bh * 0.8;
        buildings.push({ x: x0 + 8 + i * (bw * 0.5), y: y0 + bh * 0.1, w, h, hgt: 1, roof: '#4a5568', sign: i === 0 ? 'WH ' + (bx * 8 + by) : '', kind: 'warehouse' });
      }
      if (rng.chance(0.7)) props.push({ type: 'crane', x: cx, y: cy, a: rng.range(0, 6.28) });
      for (let i = 0; i < 3; i++) crates.push({ x: x0 + rng.range(20, bw - 20), y: y0 + rng.range(20, bh - 20), taken: false });
      continue;
    }
    if (d.houses) {
      for (let i = 0; i < 4; i++) {
        const w = bw * 0.2, h = bh * 0.32;
        buildings.push({ x: x0 + 10 + (i % 2) * bw * 0.5, y: y0 + 10 + Math.floor(i / 2) * bh * 0.5, w, h, hgt: 1, roof: rng.pick(['#7a5c48', '#5c6b7a', '#8a6b52', '#6b7a5c']), sign: '', kind: 'house' });
      }
      for (let i = 0; i < 3; i++) props.push({ type: 'palm', x: x0 + rng.range(10, bw), y: y0 + rng.range(10, bh) });
      continue;
    }
    // urban blocks: 1-4 buildings
    const n = d.tall ? rng.int(2, 3) : rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const w = bw / n - 14, h = bh * rng.range(0.55, 0.85);
      const sign = d.neon && rng.chance(0.75) ? rng.pick(SIGNS) : (rng.chance(0.25) ? rng.pick(SIGNS) : '');
      buildings.push({
        x: x0 + 7 + i * (bw / n), y: y0 + (bh - h) / 2, w, h,
        hgt: d.tall ? rng.int(3, 6) : rng.int(1, 3),
        roof: rng.pick([PAL.roofA, PAL.roofB, PAL.roofC, PAL.roofD]),
        sign, signCol: rng.pick([PAL.neonPink, PAL.neonCyan, PAL.neonGold, PAL.neonPurple, PAL.neonGreen]),
        kind: 'tower', seed: rng.int(0, 99999),
      });
    }
  }
  // street lamps + palms along roads
  for (let x = ROAD_W / 2; x < BEACH_X; x += BLOCK_W) for (let y = 60; y < WORLD_H; y += 200) {
    props.push({ type: 'lamp', x: x + ROAD_W / 2 + 6, y });
    if (rng.chance(0.5)) props.push({ type: 'palm', x: x - ROAD_W / 2 - 10, y: y + 90 });
  }
  for (let y = 40; y < WORLD_H; y += 700) props.push({ type: 'palm', x: BEACH_X + 60 + rng.range(0, 100), y });
  // Landmarks (fixed positions, deterministic)
  const landmarks = {
    club: { x: 620, y: 300, name: 'CLUB VELVET' },
    portWarehouse: { x: 2900, y: 500, name: 'PORT WAREHOUSE 7' },
    beachHotel: { x: 3700, y: 700, name: 'HOTEL SOL MAR' },
    garage: { x: 1500, y: 1900, name: 'GLOSS GARAGE' },
    alley: { x: 700, y: 2700, name: 'OLD TOWN ALLEY' },
    safehouse: { x: 2900, y: 2100, name: 'PALMS SAFEHOUSE' },
    police: { x: 1200, y: 1500, name: 'PALMERA PD' },
    hospital: { x: 1800, y: 900, name: 'ST LUCIA HOSPITAL' },
  };
  return { buildings, props, crates, landmarks, seed };
}

export function pointBlocked(city, x, y, pad) {
  if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return true;
  if (isWater(x, y)) return true;
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return true;
  }
  return false;
}
// Axis-separated move with collision; returns [nx, ny, hitX, hitY]
export function moveCollide(city, x, y, dx, dy, pad) {
  let nx = x + dx, ny = y, hitX = false, hitY = false;
  if (pointBlocked(city, nx, y, pad)) { nx = x; hitX = true; }
  if (pointBlocked(city, nx, y + (pad || 10), pad) && dx !== 0) { /* corner nudge ignored */ }
  ny = y + dy;
  if (pointBlocked(city, nx, ny, pad)) { ny = y; hitY = true; }
  return [nx, ny, hitX, hitY];
}
export function rectHitsBuilding(city, x, y, hw, hh) {
  if (isWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + hw > b.x && x - hw < b.x + b.w && y + hh > b.y && y - hh < b.y + b.h) return true;
  }
  return false;
}
