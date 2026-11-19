// Vice Cover Studio — the hand-in program (Node 22, standard library only).
//
// The app itself is plain static files under app/: app/index.html plus its ES
// modules, fonts and sample photos, nothing fetched from the network and no
// build step. This program copies app/ and screenshots/ from beside this file
// into the output directory and writes /output/dossier.json with the vendored
// make.fun library, so the sealed scorer can check the entry and the judge
// can read it.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; inside the
// grader it defaults to /output. Running it twice must produce identical
// bytes, so nothing here depends on the clock, on randomness, or on the
// order the filesystem happens to list files in.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a readable error instead of handing in half an entry.
if (!existsSync(join(here, 'app', 'index.html'))) {
  throw new Error('app/index.html is missing — nothing to hand in');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the bytes; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots, or one
// over 256 KiB; more than 993 files in app/, or 48 MiB of app files in all,
// or a path under app/ over 1000 bytes — app/ counts beside /output's own
// 1000-entry cap, shared with screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
