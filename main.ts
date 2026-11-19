// Vice Cover Studio — entry program for make.fun gta6-cover-art-01.
//
// Copies the app (app/) and its screenshots (screenshots/) into the output
// directory and writes /output/dossier.json with make.fun's own buildDossier
// from vendor/makefun-app.ts, so the dossier handed in is byte for byte the
// one the scorer rebuilds. Node 22+ standard library only, no dependencies,
// no network. Run it twice and the outputs are identical.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

// The caps the bounty's gate hands buildDossier (kit RULES.txt): the text
// cap shapes the dossier bytes, the rest only refuse oversized input, so
// passing them here makes this program fail exactly where the scorer would.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return resolve(fromEnv);
  return '/output';
}

function main(): void {
  const repoRoot = resolve(import.meta.dirname);
  const outDir = outputDir();

  // Start from an empty output directory so a stale file can never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const name of ['app', 'screenshots']) {
    const source = join(repoRoot, name);
    if (!existsSync(source)) {
      throw new Error(`missing ${name}/ in ${repoRoot}`);
    }
    cpSync(source, join(outDir, name), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  // Fail fast, like the scorer: a dossier over 1.5 MiB can never be graded.
  if (dossier.length > 1572864) {
    throw new Error(`dossier.json is ${dossier.length} bytes, over the 1.5 MiB cap`);
  }
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
