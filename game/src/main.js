// Neon Palms bootstrap: loop, screens state machine, save/load, shot mode.
import { W, H, STEP, SAVE_KEY } from './config.js';
import { canvasGfx } from './gfx.js';
import { createWorld, stepWorld } from './world.js';
import { initMissions, stepMissions } from './missions.js';
import { renderWorld, renderHUD, renderTitle, renderPause, renderEndOverlay, cameraFor } from './render.js';
import { KeyboardInput } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

function hasSave() {
  try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function saveGame(w) {
  try {
    const p = w.player;
    const data = { cash: p.cash, respect: p.respect, storyStage: w.storyStage, storyDone: w.storyDone, x: p.x, y: p.y, hasGun: p.hasGun, ammo: p.ammo, car: p.car ? { x: p.car.x, y: p.car.y, color: p.car.color, health: p.car.health } : null };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* no-op outside browser */ }
}
function loadGame(w) {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const d = JSON.parse(raw), p = w.player;
    p.cash = d.cash; p.respect = d.respect; p.x = d.x; p.y = d.y; p.hasGun = !!d.hasGun; p.ammo = d.ammo || 0;
    w.storyStage = d.storyStage || 0; w.storyDone = !!d.storyDone;
    return true;
  } catch (e) { return false; }
}
export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const gfx = canvasGfx(ctx);
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const status = document.getElementById('status');
  if (shot) {
    const seed = parseInt(params.get('seed') || '7', 10) || 7;
    const staged = stageShot(shot, seed);
    const g2 = canvasGfx(ctx);
    if (staged.screen === 'title') renderTitle(g2, staged.world, staged.cam, false);
    else { renderWorld(g2, staged.world, staged.cam); renderHUD(g2, staged.world); }
    if (status) status.textContent = 'Neon Palms shot: ' + shot;
    return;
  }
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  let world = createWorld(seed);
  initMissions(world);
  let screen = 'title'; // title | play | pause | busted | wasted
  let pendingEnd = null;
  const kb = new KeyboardInput(window);
  const sound = new SoundBank();
  let acc = 0, last = performance.now();
  function newGame() { world = createWorld(seed); initMissions(world); screen = 'play'; }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    const input = kb.poll();
    if (screen === 'title') {
      // idle world drift for backdrop
      stepWorld(world, { up: false, down: false, left: false, right: false, run: false, interact: false, interactPressed: false, attack: false, attackPressed: false }, STEP);
      world.events.length = 0;
      if (input.confirmPressed) newGame();
      else if (input.continuePressed && hasSave()) { newGame(); loadGame(world); screen = 'play'; }
      renderTitle(gfx, world, cameraFor(world), hasSave());
      return;
    }
    if (screen === 'pause') {
      if (input.pausePressed || input.confirmPressed) screen = 'play';
      else if (input.savePressed) { saveGame(world); }
      else if (input.restartPressed) newGame();
      renderWorld(gfx, world, cameraFor(world)); renderHUD(gfx, world); renderPause(gfx, world);
      return;
    }
    if (screen === 'busted' || screen === 'wasted') {
      if (input.confirmPressed) screen = 'play';
      renderWorld(gfx, world, cameraFor(world)); renderHUD(gfx, world); renderEndOverlay(gfx, world, screen);
      return;
    }
    if (input.pausePressed) { screen = 'pause'; return; }
    acc += dt;
    while (acc >= STEP) {
      // peek events for end screens before missions consume them
      stepWorld(world, input, STEP);
      for (const ev of world.events) if (ev.type === 'busted') pendingEnd = 'busted';
      for (const ev of world.events) if (ev.type === 'wasted') pendingEnd = 'wasted';
      // consume one-shot pressed flags after first substep
      input.interactPressed = false; input.attackPressed = false;
      stepMissions(world, STEP);
      acc -= STEP;
    }
    for (const s of world.sfx) sound.play(s);
    world.sfx.length = 0;
    sound.update(world);
    if (pendingEnd) { screen = pendingEnd; pendingEnd = null; }
    renderWorld(gfx, world, cameraFor(world));
    renderHUD(gfx, world);
    if (status) status.textContent = 'Neon Palms — cash $' + world.player.cash + ', wanted ' + world.wanted;
  }
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined') boot();
