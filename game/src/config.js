// Neon Palms — Palmera Bay. Constants and palette.
export const W = 1280, H = 720;
export const WORLD_W = 4480, WORLD_H = 3200;
export const STEP = 1 / 60;
export const BLOCK_W = 560, BLOCK_H = 400;
export const ROAD_W = 96;
export const PAL = {
  sky: '#1a1033', asphalt: '#2e2a3a', asphalt2: '#383344', sidewalk: '#6b6478',
  lane: '#e8d44d', crosswalk: '#d8d3e0', grass: '#2f6b4f', sand: '#e8c98a',
  water: '#1b4f72', water2: '#2a7ab0',
  roofA: '#4a3f5c', roofB: '#5c4a6b', roofC: '#3d3550', roofD: '#6b5578',
  wallEdge: '#241f33', windowLit: '#ffd76b', windowDark: '#2b2740',
  neonPink: '#ff2e88', neonCyan: '#22e6ff', neonGold: '#ffb020', neonGreen: '#3dff7a',
  neonPurple: '#b44dff', white: '#f4f1ff', black: '#0d0a18', grey: '#9a94ad',
  skin1: '#e8b08a', skin2: '#b07a52', skin3: '#7a4e2e',
  shirt: ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#ecf0f1','#e67e22','#1abc9c'],
  carCols: ['#c0392b','#2980b9','#27ae60','#f1c40f','#8e44ad','#ecf0f1','#e67e22','#16a085','#7f8c8d','#d35400'],
  police: '#1a2a6b', policeStripe: '#f4f1ff',
  health: '#3dff7a', healthLow: '#ff3b3b', cash: '#7dff8a', star: '#ffd76b',
  hudBg: '#0d0a18', bannerBg: '#0d0a18',
  marker: '#ffd76b', marker2: '#22e6ff', danger: '#ff3b3b',
};
export const DISTRICTS = [
  { name: 'NEON STRIP', x0: 0, y0: 0, x1: 2240, y1: 1200, neon: true },
  { name: 'DOWNTOWN', x0: 0, y0: 1200, x1: 2240, y1: 2400, tall: true },
  { name: 'OLD TOWN', x0: 0, y0: 2400, x1: 2240, y1: 3200 },
  { name: 'PORT', x0: 2240, y0: 0, x1: 3360, y1: 1600, port: true },
  { name: 'PALMS', x0: 2240, y0: 1600, x1: 3920, y1: 3200, houses: true },
  { name: 'BEACH', x0: 3920, y0: 0, x1: 4480, y1: 3200, beach: true },
];
export const SAVE_KEY = 'neon-palms-save-v1';
