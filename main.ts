// Vice Cover Studio — the make.fun program for gta6-cover-art-01.
//
// Node 22, standard library only. It gathers the entry — the static web app
// under app/ and the screenshots under screenshots/ — into the output
// directory and writes dossier.json there, the summary the judge reads,
// using the vendored make.fun library (vendor/makefun-app.ts).
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it twice in a sandbox with no network; both runs must
// produce byte-identical output, so this program only copies files and
// writes the deterministic dossier — it never reads the clock or the network.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, from the competition's RULES.txt: the dossier text is
// capped at 160 KiB, at most 4 screenshots of at most 256 KiB each, app/ at
// most 993 files and 48 MiB in all, and no path under app/ over 1000 bytes.
const DOSSIER_TEXT_MAX_BYTES = 163840;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
const APP_PATH_MAX_BYTES = 1000;

/** Refuse loudly instead of handing in an entry the gate would refuse. */
function checkShot(file: string): void {
  const size = statSync(file).size;
  if (size > SCREENSHOT_MAX_BYTES) {
    throw new Error(`${file} is ${size} bytes, over the 256 KiB screenshot cap`);
  }
}

function copyEntry(): void {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoRoot, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
}

function main(): void {
  copyEntry();
  const shotsDir = join(outputDir, 'screenshots');
  if (existsSync(shotsDir)) {
    for (const name of ['1-cover.jpg', '2-editor.jpg', '3-cover.jpg', '4-cover.jpg']) {
      const file = join(shotsDir, name);
      if (existsSync(file)) checkShot(file);
    }
  }
  writeFileSync(
    join(outputDir, 'dossier.json'),
    buildDossier(outputDir, {
      text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
      screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
      app_max_files: APP_MAX_FILES,
      app_max_bytes: APP_MAX_BYTES,
      app_path_max_bytes: APP_PATH_MAX_BYTES,
    }),
  );
  // The gate refuses a dossier over 1.5 MiB; fail here instead of handing
  // in an entry the scorer would refuse.
  const dossierSize = statSync(join(outputDir, 'dossier.json')).size;
  if (dossierSize > 1572864) {
    throw new Error(`dossier.json is ${dossierSize} bytes, over the 1.5 MiB cap`);
  }
}

main();
