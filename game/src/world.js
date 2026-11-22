// World simulation: entities, physics, AI, wanted, combat. Deterministic.
import { WORLD_W, WORLD_H, PAL } from './config.js';
import { makeRng, clamp, dist2 } from './random.js';
import { generateCity, moveCollide, pointBlocked, rectHitsBuilding, isRoad, avenueXs, streetYs, BEACH_X } from './city.js';

let nextId = 1;
export function createWorld(seed) {
  const rng = makeRng(seed * 104729 + 7);
  const city = generateCity(seed);
  const w = {
    seed, rng, city, tick: 0, time: 0,
    player: { x: 620, y: 420, vx: 0, vy: 0, angle: 0, health: 100, cash: 120, respect: 0, car: null, hasGun: false, ammo: 0, punchCd: 0, fireCd: 0, dead: false },
    cars: [], peds: [], bullets: [], particles: [], pickups: [], police: [],
    wanted: 0, wantedTimer: 0, unseenTimer: 0, bustMeter: 0,
    shake: 0, storyStage: 0, storyDone: false, banner: null, bannerT: 0,
    dialogue: null, dialogueT: 0, events: [], taxi: null, taxiTimer: 0,
    garageFee: 0, message: '', messageT: 0, sfx: [],
  };
  // Parked + traffic cars on roads
  const av = avenueXs(), st = streetYs();
  for (let i = 0; i < 46; i++) {
    const vert = rng.chance(0.5);
    let x, y, ang;
    if (vert) { x = rng.pick(av) + (rng.chance(0.5) ? 22 : -22); y = rng.range(100, WORLD_H - 100); ang = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
    else { y = rng.pick(st) + (rng.chance(0.5) ? 22 : -22); x = rng.range(100, BEACH_X - 100); ang = rng.chance(0.5) ? 0 : Math.PI; }
    if (pointBlocked(city, x, y, 20)) continue;
    const parked = i % 3 === 0;
    w.cars.push(makeCar(x, y, ang, rng.pick(PAL.carCols), parked, rng));
  }
  // Gold convertible at beach hotel (mission 2 target)
  const gold = makeCar(3700, 780, Math.PI, '#ffd700', true, rng);
  gold.isGold = true; gold.locked = true;
  w.cars.push(gold); w.goldCar = gold;
  // Marked delivery car near club (mission 1)
  const mcar = makeCar(660, 380, 0, '#22e6ff', true, rng);
  mcar.isMissionCar = true;
  w.cars.push(mcar); w.missionCar = mcar;
  // Pedestrians on sidewalks
  for (let i = 0; i < 42; i++) {
    let x = rng.range(80, BEACH_X - 40), y = rng.range(80, WORLD_H - 80), tries = 0;
    while (pointBlocked(city, x, y, 6) && tries++ < 20) { x = rng.range(80, BEACH_X - 40); y = rng.range(80, WORLD_H - 80); }
    w.peds.push(makePed(x, y, rng));
  }
  // Ammo crates pickups from city crates
  for (const c of city.crates) w.pickups.push({ x: c.x, y: c.y, kind: 'ammo', amount: 12, taken: false, ref: c });
  return w;
}
function makeCar(x, y, angle, color, parked, rng) {
  return { id: nextId++, x, y, angle, speed: 0, color, parked, driver: null, health: 100, w: 44, h: 22, police: false, ai: { targetX: x, targetY: y, wait: 0 }, smoke: 0, gold: false };
}
function makePed(x, y, rng) {
  return { id: nextId++, x, y, vx: 0, vy: 0, angle: rng.range(0, 6.28), speed: rng.range(28, 48), state: 'walk', timer: rng.range(1, 4), down: 0, health: 30, skin: rng.pick([PAL.skin1, PAL.skin2, PAL.skin3]), shirt: rng.pick(PAL.shirt), rival: false, name: '' };
}
export function addCrime(w, amount, x, y) {
  // Witnessed if any ped/police within 260px or always for big crimes
  let seen = amount >= 2;
  if (!seen) for (const p of w.peds) if (p.state !== 'down' && dist2(p.x, p.y, x, y) < 260 * 260) { seen = true; break; }
  if (!seen) for (const c of w.police) if (dist2(c.x, c.y, x, y) < 500 * 500) { seen = true; break; }
  if (seen) { w.wanted = clamp(w.wanted + amount, 0, 5); w.unseenTimer = 0; }
}
export function say(w, who, text, dur) { w.dialogue = { who, text }; w.dialogueT = dur || 4; }
export function showBanner(w, text, sub) { w.banner = { text, sub: sub || '' }; w.bannerT = 3.2; }
export function notify(w, text) { w.message = text; w.messageT = 3; }

function spawnPolice(w) {
  const p = w.player; const a = w.rng.range(0, 6.28);
  let x = clamp(p.x + Math.cos(a) * 700, 60, BEACH_X - 60), y = clamp(p.y + Math.sin(a) * 500, 60, WORLD_H - 60);
  // snap to road
  const av = avenueXs(); let best = av[0], bd = 1e18;
  for (const ax of av) { const d = Math.abs(ax - x); if (d < bd) { bd = d; best = ax; } }
  x = best;
  const car = makeCar(x, y, 0, PAL.police, false, w.rng);
  car.police = true; car.speed = 0; car.officerOut = false;
  w.police.push(car);
}
function burst(w, x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = w.rng.range(0, 6.28), s = w.rng.range(spd * 0.3, spd);
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: w.rng.range(0.2, 0.6), max: 0.6, color, size: w.rng.range(2, 5) });
  }
}
export function stepWorld(w, input, dt) {
  w.tick++; w.time += dt;
  if (w.bannerT > 0) w.bannerT -= dt;
  if (w.dialogueT > 0) w.dialogueT -= dt;
  if (w.messageT > 0) w.messageT -= dt;
  w.shake = Math.max(0, w.shake - dt * 30);
  const p = w.player;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;
  stepPlayer(w, input, dt);
  stepTraffic(w, dt);
  stepPeds(w, dt);
  stepPolice(w, dt);
  stepBullets(w, dt);
  // particles
  for (let i = w.particles.length - 1; i >= 0; i--) {
    const q = w.particles[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt;
    if (q.life <= 0) w.particles.splice(i, 1);
  }
  // pickups
  if (!p.car) for (const pk of w.pickups) {
    if (!pk.taken && dist2(pk.x, pk.y, p.x, p.y) < 28 * 28) {
      pk.taken = true; if (pk.ref) pk.ref.taken = true;
      if (pk.kind === 'ammo') { p.ammo += pk.amount; notify(w, '+' + pk.amount + ' AMMO'); w.sfx.push('cash'); }
      if (pk.kind === 'cash') { p.cash += pk.amount; notify(w, '+$' + pk.amount); w.sfx.push('cash'); }
      if (pk.kind === 'health') { p.health = clamp(p.health + 40, 0, 100); notify(w, '+ HEALTH'); }
    }
  }
  // wanted decay
  if (w.wanted > 0) {
    let seen = false;
    for (const c of w.police) if (dist2(c.x, c.y, p.x, p.y) < 460 * 460) { seen = true; break; }
    if (!seen) { w.unseenTimer += dt; if (w.unseenTimer > 9) { w.wanted--; w.unseenTimer = 0; if (w.wanted === 0) notify(w, 'YOU LOST THE COPS'); } }
    else w.unseenTimer = 0;
    const want = Math.min(1 + w.wanted, 5);
    while (w.police.length < want) { w.wantedTimer -= dt; if (w.wantedTimer <= 0) { spawnPolice(w); w.wantedTimer = 1.2; } break; }
    // despawn far police when wanted 0 handled below
  }
  if (w.wanted === 0) {
    for (let i = w.police.length - 1; i >= 0; i--) if (dist2(w.police[i].x, w.police[i].y, p.x, p.y) > 900 * 900) w.police.splice(i, 1);
  }
  // taxi side job
  stepTaxi(w, dt);
  // garage respray
  const g = w.city.landmarks.garage;
  if (p.car && w.wanted > 0 && dist2(p.car.x, p.car.y, g.x, g.y) < 90 * 90) {
    const fee = 100 * w.wanted;
    if (p.cash >= fee && input.interact) { p.cash -= fee; w.wanted = 0; w.police.length = 0; notify(w, 'RESPRAYED -$' + fee); w.sfx.push('cash'); }
  }
}
function stepPlayer(w, input, dt) {
  const p = w.player, city = w.city;
  if (p.car) {
    const c = p.car;
    const accel = 260, maxF = 330, maxR = -120;
    if (input.up) c.speed += accel * dt;
    else if (input.down) c.speed -= (c.speed > 5 ? 420 : 160) * dt;
    else c.speed *= Math.pow(0.4, dt);
    c.speed = clamp(c.speed, maxR, maxF);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (Math.abs(c.speed) > 4) c.angle += steer * 1.9 * dt * Math.sign(c.speed) * clamp(Math.abs(c.speed) / 120, 0.3, 1);
    const dx = Math.cos(c.angle) * c.speed * dt, dy = Math.sin(c.angle) * c.speed * dt;
    const nx = c.x + dx, ny = c.y + dy;
    if (rectHitsBuilding(city, nx, ny, 20, 14) || nx < 30 || ny < 30 || nx > WORLD_W - 30 || ny > WORLD_H - 30) {
      if (Math.abs(c.speed) > 130) { c.health -= 18; w.shake = 10; burst(w, c.x, c.y, '#ffb020', 10, 120); w.sfx.push('crash'); }
      else if (Math.abs(c.speed) > 40) { c.health -= 5; w.sfx.push('crash'); }
      c.speed = -c.speed * 0.35;
    } else { c.x = nx; c.y = ny; }
    c.health = clamp(c.health, 0, 100);
    if (c.health <= 25 && w.tick % 8 === 0) w.particles.push({ x: c.x, y: c.y - 6, vx: w.rng.range(-8, 8), vy: -30, life: 0.7, max: 0.7, color: '#555', size: 6 });
    if (c.health <= 0) { c.speed = 0; }
    if ((Math.abs(c.speed) > 60 && (input.left || input.right) && w.tick % 3 === 0)) w.particles.push({ x: c.x - Math.cos(c.angle) * 16, y: c.y - Math.sin(c.angle) * 16, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#ccc', size: 4 });
    // run over peds (knockdown, non-lethal)
    if (Math.abs(c.speed) > 50) for (const ped of w.peds) {
      if (ped.state !== 'down' && dist2(ped.x, ped.y, c.x, c.y) < 26 * 26) {
        ped.state = 'down'; ped.down = 4; ped.health -= 15;
        addCrime(w, 1, ped.x, ped.y); burst(w, ped.x, ped.y, '#fff', 6, 80); w.sfx.push('punch');
        if (w.rng.chance(0.5)) w.pickups.push({ x: ped.x + 10, y: ped.y, kind: 'cash', amount: w.rng.int(5, 25), taken: false });
      }
    }
    // collide police cars
    for (const pc of w.police) if (dist2(pc.x, pc.y, c.x, c.y) < 42 * 42) {
      if (Math.abs(c.speed) > 60) { addCrime(w, 2, c.x, c.y); pc.health -= 12; w.shake = 8; }
      c.speed *= 0.6; pc.speed *= 0.5;
      const a = Math.atan2(pc.y - c.y, pc.x - c.x); pc.x += Math.cos(a) * 6; pc.y += Math.sin(a) * 6;
    }
    p.x = c.x; p.y = c.y; p.angle = c.angle;
    if (input.interactPressed) exitCar(w);
    if (c.police === false && w.wanted > 0) { /* driving wanted */ }
    w.engineSpeed = Math.abs(c.speed);
  } else {
    const run = input.run ? 215 : 128;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx || my) { const l = Math.hypot(mx, my); mx /= l; my /= l; p.angle = Math.atan2(my, mx); }
    const [nx, ny] = moveCollide(city, p.x, p.y, mx * run * dt, my * run * dt, 8);
    p.x = nx; p.y = ny;
    w.engineSpeed = 0;
    // attack
    if (input.attackPressed && p.punchCd <= 0) {
      p.punchCd = 0.32;
      if (p.hasGun && p.ammo > 0) {
        p.ammo--; p.fireCd = 0.22; w.sfx.push('shot');
        const a = p.angle;
        w.bullets.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.7, hostile: false });
        burst(w, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, '#ffd76b', 3, 60);
        addCrime(w, 1, p.x, p.y);
        for (const ped of w.peds) if (dist2(ped.x, ped.y, p.x, p.y) < 200 * 200 && ped.state === 'walk') { ped.state = 'flee'; ped.timer = 2.5; }
      } else {
        w.sfx.push('punch');
        for (const ped of w.peds) {
          if (ped.state !== 'down' && dist2(ped.x, ped.y, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20) < 26 * 26) {
            ped.state = 'down'; ped.down = 3; ped.health -= 20; burst(w, ped.x, ped.y, '#fff', 5, 70);
            if (!ped.rival) addCrime(w, 1, ped.x, ped.y);
            if (w.rng.chance(0.4)) w.pickups.push({ x: ped.x + 8, y: ped.y, kind: 'cash', amount: w.rng.int(5, 20), taken: false });
          }
        }
      }
    }
    if (input.interactPressed) {
      // nearest car
      let best = null, bd = 52 * 52;
      for (const c of w.cars) { const d = dist2(c.x, c.y, p.x, p.y); if (d < bd) { bd = d; best = c; } }
      for (const c of w.police) { const d = dist2(c.x, c.y, p.x, p.y); if (d < bd) { bd = d; best = c; } }
      if (best) enterCar(w, best);
    }
  }
}
export function enterCar(w, car) {
  const p = w.player;
  const wasParked = car.parked;
  if (car.driver) { // driver flees
    const d = car.driver; d.x = car.x + 26; d.y = car.y + 10; d.state = 'flee'; d.timer = 3; w.peds.push(d); car.driver = null;
  }
  car.parked = false; p.car = car; p.x = car.x; p.y = car.y;
  w.sfx.push('door');
  if (wasParked || car.driver === null) {
    // stealing a parked/driverless car is a crime if witnessed; mission cars flagged by missions logic
    if (!car.noCrime) addCrime(w, 1, car.x, car.y);
  }
  w.events.push({ type: 'enterCar', car });
}
export function exitCar(w) {
  const p = w.player; if (!p.car) return;
  const c = p.car; p.car = null;
  p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 26; p.y = c.y + Math.sin(c.angle + Math.PI / 2) * 26;
  if (pointBlocked(w.city, p.x, p.y, 8)) { p.x = c.x - Math.cos(c.angle + Math.PI / 2) * 26; p.y = c.y - Math.sin(c.angle + Math.PI / 2) * 26; }
  c.speed = 0; w.events.push({ type: 'exitCar', car: c });
}
function stepTraffic(w, dt) {
  const p = w.player;
  for (const c of w.cars) {
    if (c.parked || p.car === c || c.health <= 0) continue;
    if (dist2(c.x, c.y, p.x, p.y) > 1100 * 1100) { c.speed = 0; continue; }
    const ai = c.ai;
    // follow road: pick target at next intersection in facing direction
    if (ai.wait > 0) { ai.wait -= dt; c.speed *= 0.8; continue; }
    let tx = c.x + Math.cos(c.angle) * 120, ty = c.y + Math.sin(c.angle) * 120;
    // at intersection, maybe turn
    if (isRoad(c.x, c.y)) {
      const nearX = Math.round((c.x - 48) / 560) * 560 + 48, nearY = Math.round((c.y - 48) / 400) * 400 + 48;
      if (Math.abs(c.x - nearX) < 30 && Math.abs(c.y - nearY) < 30 && w.rng.chance(0.012)) {
        c.angle = w.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
    }
    // keep on road: steer target back to road centre
    if (!isRoad(tx, ty)) {
      // turn toward nearest road direction
      c.angle += 1.6 * dt;
      tx = c.x + Math.cos(c.angle) * 80; ty = c.y + Math.sin(c.angle) * 80;
    }
    const want = Math.atan2(ty - c.y, tx - c.x);
    let da = want - c.angle; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
    c.angle += clamp(da, -2.2 * dt, 2.2 * dt);
    // brake for obstacle ahead
    let target = 150;
    const ax = c.x + Math.cos(c.angle) * 55, ay = c.y + Math.sin(c.angle) * 55;
    for (const ped of w.peds) if (ped.state !== 'down' && dist2(ped.x, ped.y, ax, ay) < 30 * 30) target = 0;
    if (p.car !== c && !p.car && dist2(p.x, p.y, ax, ay) < 30 * 30) target = 0;
    for (const o of w.cars) if (o !== c && dist2(o.x, o.y, ax, ay) < 44 * 44) target = 0;
    if (p.car && dist2(p.car.x, p.car.y, c.x, c.y) < 120 * 120 && Math.abs(p.car.speed) > 200) target = 0; // flee reckless player: stop
    c.speed += clamp(target - c.speed, -300 * dt, 120 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!rectHitsBuilding(w.city, nx, ny, 20, 14) && nx > 30 && ny > 30 && nx < WORLD_W - 30 && ny < WORLD_H - 30) { c.x = nx; c.y = ny; }
    else { c.speed = 0; ai.wait = 0.6; c.angle += Math.PI / 2; }
  }
}
function stepPeds(w, dt) {
  const p = w.player;
  for (const ped of w.peds) {
    if (ped.state === 'down') { ped.down -= dt; if (ped.down <= 0 && ped.health > 0) ped.state = 'walk'; continue; }
    if (ped.state === 'dead') continue;
    ped.timer -= dt;
    if (ped.rival) { stepRival(w, ped, dt); continue; }
    if (ped.state === 'flee' || (p.car && Math.abs(p.car.speed) > 140 && dist2(ped.x, ped.y, p.x, p.y) < 90 * 90)) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      const [nx, ny] = moveCollide(w.city, ped.x, ped.y, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, 6);
      ped.x = nx; ped.y = ny; ped.angle = a;
      if (ped.timer <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.timer <= 0) { ped.angle = w.rng.range(0, 6.28); ped.timer = w.rng.range(1.5, 4); }
    let nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (pointBlocked(w.city, nx, ny, 6)) { ped.angle += 2.2 * dt; continue; }
    ped.x = nx; ped.y = ny;
  }
}
function stepRival(w, ped, dt) {
  const p = w.player;
  const d = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
  ped.fireCd = (ped.fireCd || 0) - dt;
  if (d > 190) {
    const a = Math.atan2(p.y - ped.y, p.x - ped.x);
    const [nx, ny] = moveCollide(w.city, ped.x, ped.y, Math.cos(a) * 90 * dt, Math.sin(a) * 90 * dt, 6);
    ped.x = nx; ped.y = ny; ped.angle = a;
  } else {
    ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    if (ped.fireCd <= 0) {
      ped.fireCd = w.rng.range(0.7, 1.3);
      const inacc = w.rng.range(-0.16, 0.16), a = ped.angle + inacc;
      w.bullets.push({ x: ped.x + Math.cos(a) * 14, y: ped.y + Math.sin(a) * 14, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.6, hostile: true });
      w.sfx.push('shot');
    }
  }
}
function stepPolice(w, dt) {
  const p = w.player;
  if (w.wanted === 0) { w.bustMeter = Math.max(0, w.bustMeter - dt * 30); return; }
  let anyClose = false;
  for (const c of w.police) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    if (!p.car && d < 130) {
      // officer on foot logic: car stops, officer approaches (represented by car creep + bust)
      c.speed *= 0.85;
      if (d < 55) { anyClose = true; }
      continue;
    }
    // chase: steer at player
    const want = Math.atan2(p.y - c.y, p.x - c.x);
    let da = want - c.angle; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
    c.angle += clamp(da, -2.4 * dt, 2.4 * dt);
    const target = p.car ? clamp(Math.abs(p.car.speed) + 60, 180, 390) : 240;
    c.speed += clamp(target - c.speed, -260 * dt, 170 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!rectHitsBuilding(w.city, nx, ny, 20, 14) && nx > 25 && ny > 25 && nx < WORLD_W - 25 && ny < WORLD_H - 25) { c.x = nx; c.y = ny; }
    else { c.speed = -60; c.health -= 2; }
    if (p.car && d < 46) { // ram
      p.car.speed *= 0.82; p.car.health -= 4; c.speed *= 0.6; w.shake = Math.max(w.shake, 5);
      if (w.tick % 20 === 0) w.sfx.push('crash');
    }
    if (d < 55 && !p.car) anyClose = true;
  }
  const playerSlow = !p.car;
  if (anyClose && playerSlow) {
    w.bustMeter += dt * 34;
    if (w.bustMeter >= 100) w.events.push({ type: 'busted' });
  } else w.bustMeter = Math.max(0, w.bustMeter - dt * 40);
}
function stepBullets(w, dt) {
  const p = w.player;
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let kill = b.life <= 0 || pointBlocked(w.city, b.x, b.y, 0);
    if (!kill && b.hostile) {
      const tgt = p.car || p;
      if (dist2(b.x, b.y, tgt.x, tgt.y) < 18 * 18) {
        p.health -= 9; kill = true; burst(w, b.x, b.y, '#ff3b3b', 4, 60);
        if (p.health <= 0) w.events.push({ type: 'wasted' });
      }
    }
    if (!kill && !b.hostile) {
      for (const ped of w.peds) {
        if (ped.state !== 'down' && ped.state !== 'dead' && dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
          ped.health -= 34; kill = true; burst(w, b.x, b.y, '#ff3b3b', 5, 70);
          if (ped.health <= 0) {
            if (ped.rival) { ped.state = 'dead'; w.events.push({ type: 'rivalDown', ped }); }
            else { ped.state = 'down'; ped.down = 6; ped.health = 5; }
            if (!ped.rival) addCrime(w, 1, ped.x, ped.y);
            if (w.rng.chance(0.5)) w.pickups.push({ x: ped.x + 8, y: ped.y, kind: 'ammo', amount: 6, taken: false });
          } else if (!ped.rival) { ped.state = 'flee'; ped.timer = 3; }
          break;
        }
      }
      if (!kill) for (const c of w.police) if (dist2(b.x, b.y, c.x, c.y) < 24 * 24) { c.health -= 20; kill = true; addCrime(w, 1, c.x, c.y); }
    }
    if (kill) w.bullets.splice(i, 1);
  }
}
function stepTaxi(w, dt) {
  const p = w.player;
  w.taxiTimer -= dt;
  if (!w.taxi && p.car && w.storyStage >= 1 && w.taxiTimer <= 0) {
    // spawn fare pickup near player
    const a = w.rng.range(0, 6.28);
    let x = clamp(p.x + Math.cos(a) * 500, 100, BEACH_X - 60), y = clamp(p.y + Math.sin(a) * 400, 100, WORLD_H - 100);
    w.taxi = { phase: 'pickup', x, y, destX: clamp(x + w.rng.range(-900, 900), 100, BEACH_X - 60), destY: clamp(y + w.rng.range(-700, 700), 100, WORLD_H - 100), t: 0 };
  }
  if (w.taxi && p.car) {
    const t = w.taxi; t.t += dt;
    const tx = t.phase === 'pickup' ? t.x : t.destX, ty = t.phase === 'pickup' ? t.y : t.destY;
    if (dist2(p.car.x, p.car.y, tx, ty) < 60 * 60 && Math.abs(p.car.speed) < 30) {
      if (t.phase === 'pickup') { t.phase = 'dropoff'; t.t = 0; notify(w, 'FARE PICKED UP'); w.sfx.push('cash'); }
      else {
        const fare = 60 + Math.max(0, 120 - Math.floor(t.t)) * 2;
        p.cash += fare; p.respect += 2; notify(w, 'FARE +$' + fare); w.sfx.push('cash');
        w.taxi = null; w.taxiTimer = 14;
      }
    }
  }
  if (w.taxi && !p.car) { /* fare waits */ }
}
export function respawnAt(w, kind) {
  const p = w.player;
  const lm = kind === 'busted' ? w.city.landmarks.police : w.city.landmarks.hospital;
  if (p.car) { p.car.speed = 0; p.car = null; }
  p.x = lm.x; p.y = lm.y + 60; p.health = 100; w.wanted = 0; w.police.length = 0; w.bustMeter = 0; w.bullets.length = 0;
  for (const ped of w.peds) if (ped.rival) ped.state = 'dead';
}
