// Mission chain for Neon Palms. Markers appear in order; failure retries current mission.
import { dist2 } from './random.js';
import { say, showBanner, notify, respawnAt } from './world.js';

export const MISSION_NAMES = ['FIRST RUN', 'HOT WHEELS', 'TURF WAR'];
// stage: 0 meet Marisol, 1 drive to port, 2 meet for job2 briefing (auto), 3 steal gold, 4 lose cops+deliver,
// 5 go alley, 6 fight rivals, 7 escape to safehouse, 8 done (free roam)
export function currentObjective(w) {
  const L = w.city.landmarks;
  switch (w.storyStage) {
    case 0: return { text: 'MEET MARISOL AT CLUB VELVET', x: L.club.x, y: L.club.y };
    case 1: return { text: w.player.car === w.missionCar ? 'DELIVER THE PACKAGE TO PORT WAREHOUSE 7' : 'GET IN THE MARKED CAR', x: w.player.car === w.missionCar ? L.portWarehouse.x : w.missionCar.x, y: w.player.car === w.missionCar ? L.portWarehouse.y : w.missionCar.y, timer: w.missionTimer };
    case 2: return { text: 'MEET MARISOL AT CLUB VELVET', x: L.club.x, y: L.club.y };
    case 3: return { text: 'STEAL THE GOLD CONVERTIBLE AT HOTEL SOL MAR', x: w.goldCar.x, y: w.goldCar.y };
    case 4: return { text: w.wanted > 0 ? 'LOSE THE POLICE!' : 'DELIVER THE CAR TO GLOSS GARAGE', x: L.garage.x, y: L.garage.y };
    case 5: return { text: 'MEET MARISOL IN THE OLD TOWN ALLEY', x: L.alley.x, y: L.alley.y };
    case 6: return { text: 'DEFEAT THE RIVALS (' + (w.rivalsLeft || 0) + ' LEFT)', x: L.alley.x, y: L.alley.y };
    case 7: return { text: 'ESCAPE TO THE PALMS SAFEHOUSE', x: L.safehouse.x, y: L.safehouse.y };
    default: return w.taxi && w.player.car ? { text: w.taxi.phase === 'pickup' ? 'TAXI: PICK UP FARE' : 'TAXI: DROP OFF FARE', x: w.taxi.phase === 'pickup' ? w.taxi.x : w.taxi.destX, y: w.taxi.phase === 'pickup' ? w.taxi.y : w.taxi.destY } : { text: 'FREE ROAM - PALMERA BAY IS YOURS', x: null, y: null };
  }
}
function reward(w, cash, respect) {
  w.player.cash += cash; w.player.respect += respect;
  showBanner(w, 'MISSION COMPLETE', '+$' + cash + '  RESPECT +' + respect);
  w.sfx.push('sting');
}
export function initMissions(w) {
  w.missionTimer = 0; w.rivalsLeft = 0; w.missionFailed = false;
  if (!w.introDone) { say(w, 'MARISOL (PHONE)', 'KID, MEET ME AT CLUB VELVET. WORK WAITS.', 5); w.introDone = true; }
}
export function failMission(w, reason) {
  showBanner(w, 'MISSION FAILED', reason + ' - RETRY FROM THE MARKER');
  w.sfx.push('fail');
  // reset stage-specific state to stage start
  if (w.storyStage === 1) { w.storyStage = 0; resetMissionCar(w); }
  if (w.storyStage === 4) { w.storyStage = 3; w.wanted = 0; w.police.length = 0; }
  if (w.storyStage === 6 || w.storyStage === 7) { w.storyStage = 5; clearRivals(w); }
}
function resetMissionCar(w) {
  const c = w.missionCar; if (!c) return;
  if (w.player.car === c) { w.player.car = null; }
  c.x = 660; c.y = 380; c.angle = 0; c.speed = 0; c.parked = true; c.health = 100; c.noCrime = false;
}
function clearRivals(w) {
  for (let i = w.peds.length - 1; i >= 0; i--) if (w.peds[i].rival) w.peds.splice(i, 1);
  w.rivalsLeft = 0;
}
function spawnRivals(w) {
  clearRivals(w);
  const L = w.city.landmarks;
  for (let i = 0; i < 5; i++) {
    w.peds.push({ id: 900 + i, x: L.alley.x + (i - 2) * 46, y: L.alley.y - 60 + (i % 2) * 50, vx: 0, vy: 0, angle: 3.14, speed: 60, state: 'walk', timer: 1, down: 0, health: 68, skin: '#b07a52', shirt: '#111111', rival: true, name: 'RIVAL', fireCd: 1 + i * 0.3 });
  }
  w.rivalsLeft = 5;
}
export function stepMissions(w, dt) {
  const p = w.player, L = w.city.landmarks;
  // consume world events
  for (const ev of w.events) {
    if (ev.type === 'busted') { p.cash -= Math.floor(p.cash * 0.15); respawnAt(w, 'busted'); showBanner(w, 'BUSTED', 'THE COPS TOOK 15% OF YOUR CASH'); failMissionSoft(w); }
    if (ev.type === 'wasted') { const fee = Math.min(200, p.cash); p.cash -= fee; respawnAt(w, 'wasted'); showBanner(w, 'WASTED', 'HOSPITAL FEE -$' + fee); failMissionSoft(w); }
    if (ev.type === 'rivalDown') { if (w.storyStage === 6) { w.rivalsLeft--; notify(w, 'RIVAL DOWN - ' + w.rivalsLeft + ' LEFT'); if (w.rivalsLeft <= 0) { w.storyStage = 7; w.wanted = Math.max(w.wanted, 2); say(w, 'MARISOL', 'COPS INBOUND! GET TO THE SAFEHOUSE!', 4); } } }
    if (ev.type === 'enterCar') {
      if (w.storyStage === 1 && ev.car === w.missionCar) { w.missionTimer = 100; say(w, 'MARISOL', 'PACKAGE IS IN THE TRUNK. PORT. FAST.', 4); }
      if (w.storyStage === 3 && ev.car === w.goldCar) { w.storyStage = 4; w.wanted = 3; w.unseenTimer = 0; say(w, 'RADIO', 'STOLEN GOLD CONVERTIBLE - ALL UNITS RESPOND!', 4); showBanner(w, 'HOT WHEELS', 'LOSE THE COPS, THEN HIT GLOSS GARAGE'); }
    }
  }
  w.events.length = 0;
  const near = (x, y, r) => dist2(p.x, p.y, x, y) < r * r;
  switch (w.storyStage) {
    case 0:
      w.missionCar.noCrime = true;
      if (near(L.club.x, L.club.y, 70) && !p.car) {
        say(w, 'MARISOL', 'TAKE MY CAR. PACKAGE TO THE PORT WAREHOUSE. GO.', 4.5);
        w.storyStage = 1;
      }
      break;
    case 1:
      if (p.car === w.missionCar) {
        w.missionTimer -= dt;
        if (w.missionTimer <= 0) { failMission(w, 'OUT OF TIME'); break; }
        if (near(L.portWarehouse.x, L.portWarehouse.y, 95)) {
          reward(w, 500, 10); w.storyStage = 2;
          say(w, 'MARISOL (PHONE)', 'CLEAN WORK. COME BACK TO THE CLUB.', 4);
        }
      }
      break;
    case 2:
      if (near(L.club.x, L.club.y, 70) && !p.car) {
        say(w, 'MARISOL', 'GOLD CONVERTIBLE AT HOTEL SOL MAR. BRING IT TO GLOSS.', 4.5);
        w.storyStage = 3; w.goldCar.noCrime = true;
      }
      break;
    case 3: break; // enterCar event advances
    case 4:
      if (p.car === w.goldCar && w.wanted === 0 && near(L.garage.x, L.garage.y, 100)) {
        reward(w, 900, 20); w.storyStage = 5;
        say(w, 'MARISOL (PHONE)', 'ONE LAST THING. OLD TOWN ALLEY. COME ARMED... I WILL ARM YOU.', 4);
      }
      break;
    case 5:
      if (near(L.alley.x, L.alley.y, 70) && !p.car) {
        p.hasGun = true; p.ammo += 40;
        say(w, 'MARISOL', 'TAKE THIS PISTOL. THE VULTURES ARE COMING. HOLD THE ALLEY!', 4.5);
        spawnRivals(w); w.storyStage = 6; w.sfx.push('sting');
      }
      break;
    case 6: break; // rivalDown events advance
    case 7:
      if (near(L.safehouse.x, L.safehouse.y, 85)) {
        reward(w, 1500, 40); w.storyStage = 8; w.storyDone = true; w.wanted = 0; w.police.length = 0;
        showBanner(w, 'STORY COMPLETE', 'NEON PALMS IS YOURS - FREE ROAM');
        say(w, 'MARISOL', 'YOU RUN PALMERA NOW, KID. STAY SHINY.', 5);
      }
      break;
  }
}
function failMissionSoft(w) {
  // after wasted/busted, retry current mission from its start
  if (w.storyStage === 1) { w.storyStage = 0; resetMissionCar(w); }
  else if (w.storyStage === 4) { w.storyStage = 3; }
  else if (w.storyStage === 6 || w.storyStage === 7) { w.storyStage = 5; clearRivals(w); }
}
