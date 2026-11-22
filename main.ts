// Neon Palms — Palmera Bay (gta6-01 entry, Node 22, standard library only): an original
// top-down 2D open-world crime game set in the fictional neon coastal city of Palmera Bay.
// The game lives in this directory's game/ folder as plain static files a desktop browser
// loads fully offline (game/index.html plus its ES modules, no library, no network request):
// a seeded, deterministic city (Neon Strip, Downtown, Old Town, the Port, Palms and a beach)
// with drivable/stealable cars, traffic and pedestrian AI, a 0-5 star police wanted system
// with bust/wasted outcomes, a 3-mission story chain plus a repeatable taxi side job, a HUD
// with minimap, title/pause/end screens, localStorage saves, procedural WebAudio sounds, and
// all text drawn in a custom 5x7 bitmap font through a primitives-only drawing layer so a
// software renderer reproduces the exact same frames for screenshots (tools/render-shots.mjs).
// This program copies game/ and screenshots/ from beside this file to /output, writes
// /output/entry.json (entry title + game path, stable key order) and /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'entry.json'), JSON.stringify({ game: 'game/index.html', title: 'Neon Palms — Palmera Bay' }) + '\n');
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
