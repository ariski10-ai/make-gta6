// Deterministic shot staging: steps the real simulation with scripted inputs.
import { createWorld } from './world.js';
import { stepWorld } from './world.js';
import { initMissions, stepMissions } from './missions.js';
import { ScriptedInput } from './input.js';
import { cameraFor } from './render.js';

function runSteps(w, input, n) {
  for (let i = 0; i < n; i++) {
    const inp = input.poll(w.tick);
    stepWorld(w, inp, 1 / 60);
    stepMissions(w, 1 / 60);
    w.events.length = 0; // staging consumes silently except mission flow already handled inside stepMissions copy
  }
}
// NOTE: stepMissions consumes w.events itself; runSteps above calls it after stepWorld.
function stage(seed, setup) {
  const w = createWorld(seed);
  initMissions(w);
  setup(w);
  return w;
}
export function stageShot(name, seed) {
  if (name === 'cover') {
    const w = stage(seed, () => {});
    // vista camera over Neon Strip
    w.player.x = 900; w.player.y = 500;
    const idle = new ScriptedInput(() => ({}));
    runSteps(w, idle, 30);
    return { world: w, screen: 'title', cam: { x: 300, y: 140 } };
  }
  if (name === 'street') {
    const w = stage(seed, (ww) => {
      ww.player.x = 620; ww.player.y = 470; ww.player.angle = 0.4;
    });
    const walk = new ScriptedInput((t) => t < 40 ? { right: true } : {});
    runSteps(w, walk, 70);
    return { world: w, screen: 'play', cam: cameraFor(w) };
  }
  if (name === 'chase') {
    const w = stage(seed, (ww) => {
      // put player in a car on an avenue, wanted 3, police close behind
      const car = ww.cars.find(c => !c.parked && !c.isGold && !c.isMissionCar) || ww.cars[0];
      car.x = 1128; car.y = 700; car.angle = Math.PI / 2; car.speed = 210; car.parked = false;
      ww.player.car = car; ww.player.x = car.x; ww.player.y = car.y;
      ww.wanted = 3; ww.storyStage = 8;
      car.noCrime = true;
    });
    const drive = new ScriptedInput(() => ({ up: true }));
    runSteps(w, drive, 55);
    w.wanted = 3; // keep stars for the frame
    w.taxi = null; w.taxiTimer = 999; w.dialogue = null; w.dialogueT = 0;
    // Final framing (no further steps): player speeding down an avenue, two pursuers behind.
    const pc = w.player.car;
    if (pc) {
      pc.x = 1106; pc.y = 760; pc.angle = Math.PI / 2; pc.speed = 235; pc.health = 82;
      w.player.x = pc.x; w.player.y = pc.y;
      w.police.length = 0;
      for (let i = 0; i < 2; i++) {
        w.police.push({ id: 500 + i, x: 1106 + (i === 0 ? -24 : 26), y: 760 - 120 - i * 95, angle: Math.PI / 2, speed: 220, color: '#1a2a6b', parked: false, driver: null, health: 100, w: 44, h: 22, police: true, ai: { targetX: 0, targetY: 0, wait: 0 }, smoke: 0 });
      }
    }
    return { world: w, screen: 'play', cam: cameraFor(w) };
  }
  // mission: arrived at port warehouse delivery marker in mission 1
  const w = stage(seed, (ww) => {
    ww.storyStage = 1;
    const mc = ww.missionCar;
    mc.x = ww.city.landmarks.portWarehouse.x - 40; mc.y = ww.city.landmarks.portWarehouse.y + 190;
    mc.angle = 0; mc.speed = 0; mc.parked = false; mc.noCrime = true;
    ww.player.car = mc; ww.player.x = mc.x; ww.player.y = mc.y;
    ww.missionTimer = 42;
  });
  const idle = new ScriptedInput(() => ({}));
  // step without triggering completion wipe: step sim only, keep dialogue
  for (let i = 0; i < 20; i++) stepWorld(w, idle.poll(w.tick), 1 / 60);
  w.storyStage = 2; // delivery done: next objective is the club rendezvous
  w.dialogue = { who: 'MARISOL', text: 'PACKAGE DELIVERED CLEAN. $500 IS YOURS, KID.' };
  w.dialogueT = 99;
  w.banner = { text: 'MISSION COMPLETE', sub: '+$500  RESPECT +10' };
  w.bannerT = 99;
  w.player.cash = 620; w.player.respect = 10;
  const cam = cameraFor(w); cam.y -= 190; // keep the delivered car clear of the centre banner
  return { world: w, screen: 'play', cam };
}
