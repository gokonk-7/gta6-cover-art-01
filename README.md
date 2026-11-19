# Vice Cover Studio

[![Owner: gokonk-7](https://img.shields.io/badge/owner-gokonk--7-ff5c8a)](https://github.com/gokonk-7)
[![Repo: gta6-cover-art-01](https://img.shields.io/badge/repo-gta6--cover--art--01-7b2ff7)](https://github.com/gokonk-7/gta6-cover-art-01)
[![make.fun referral: sqj6a0rx](https://img.shields.io/badge/make.fun-sqj6a0rx-00d1b2)](https://make.fun/r/sqj6a0rx)

Turn any photo and a caption into GTA-poster-style cover art — right in your
browser, fully offline. Pick a layout, drop in up to four photos, grade it
like a Vice City sunset, and export a share-ready PNG.

Built for the make.fun bounty
[**gta6-cover-art-01 — "Make GTA 6 Cover Art"**](https://make.fun/bounty/gta6-cover-art-01)
($250 pot, top 50). Entry is free and open source (MIT).

## What it does

- **4 cover layouts** — Triptych (hero left + two stacked right), Comic (three
  vertical panels), Hero+Duo (big top panel + two below), Quad (2×2 grid).
- **Per-panel photos** — upload your own (files never leave your machine) or
  use the four bundled samples. Drag to pan, slide to zoom, cover-fit crop
  handles portrait, landscape and square shots.
- **4 colour grades** — Sunset, Neon, Golden Hour and Noir, applied as canvas
  overlays on top of a procedural Vice City backdrop: synthwave sun, skyline,
  palm silhouettes and a glowing grid horizon. All artwork is drawn in code —
  no Rockstar logos, artwork or fonts.
- **Bold caption lettering** — editable title + subtitle in Anton (SIL OFL,
  bundled under `app/fonts/`), with outline and drop shadow.
- **One-click PNG export** — 1080×1080, 1080×1350 and 1920×1080, via
  `canvas.toBlob`. Photo → caption → export in seconds.

## Run it

```bash
node serve.ts        # serves app/ at http://localhost:8123
```

Then open the page, load photos, pick a layout and grade, and hit Export.
No build step, no network requests, no accounts. Everything lives under
`app/`.

## Screenshot scenes

Append a query string to preview a scene (used for the screenshots in
`screenshots/`):

- `?shot=cover&layout=triptych&grade=sunset&caption=VICE%20HEIST` — cover
  alone, fullscreen, no editor chrome.
- `?shot=editor` — the editor with a sample photo loaded.

## Layout of the repo

- `main.ts` — hands the app in: copies `app/` + `screenshots/` to the output
  directory and writes `dossier.json` via `vendor/makefun-app.ts`.
- `serve.ts` — tiny static file server for local testing.
- `app/index.html`, `app/style.css` — page shell and neon-dark UI.
- `app/src/cover.js` — the canvas renderer (backdrop, panels, grades,
  lettering, export).
- `app/src/editor.js` — UI wiring: uploads, panels, controls, exports.
- `app/src/shots.js` — `?shot=` scenes for screenshots.
- `app/fonts/`, `app/samples/` — bundled font and sample photos.

## License

MIT — see [LICENSE](LICENSE). Anton is © The Anton Project Authors, SIL
Open Font License 1.1 (see `app/fonts/FONTS.md`).
