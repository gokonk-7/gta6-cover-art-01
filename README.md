[![make.fun bounty](https://img.shields.io/badge/make.fun-gta6--cover--art--01-ff2d78)](https://make.fun/bounty/gta6-cover-art-01)
[![owner gokonk-7](https://img.shields.io/badge/owner-gokonk--7-00d1ff)](https://github.com/gokonk-7)
[![referral sqj6a0rx](https://img.shields.io/badge/referral-sqj6a0rx-ffd166)](https://make.fun/r/sqj6a0rx)

# Vice Cover Studio

Built for the **gta6-cover-art-01** bounty on [make.fun](https://make.fun/bounty/gta6-cover-art-01):
turn any photo and a caption into GTA 6 poster-style cover art, in the browser,
offline, exported as a PNG to share.

## What it does

- **Four poster layouts** — Triptych, Comic, Hero + Duo, and Quad — switchable live.
- **Any photo, any panel** — upload your own photos (they never leave your
  machine) or use the bundled samples. Drag to pan each photo, zoom per panel,
  cover-fit crop handles portrait, landscape and square shots.
- **Bold poster lettering** — an editable title and subtitle set in Anton, with
  a heavy outline and drop shadow, over a procedural Vice City sunset.
- **Four colour grades** — Sunset, Neon, Golden Hour and Noir, applied as
  canvas tints and washes.
- **A painted backdrop, drawn on canvas** — striped synthwave sun, skyline and
  palm silhouettes, a perspective grid on the horizon. No Rockstar artwork,
  logos or fonts anywhere: every pixel is drawn by the app itself.
- **One-click PNG export** in 1080 × 1080, 1080 × 1350 and 1920 × 1080.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a layout and a grade, drop a photo into each panel (or keep the samples),
type a title, hit an export button. The app is plain static files under `app/`
— no build step, no network requests, no tracking.

## Layout of the repo

- `app/index.html`, `app/style.css` — the editor page and its styling.
- `app/src/cover.js` — the renderer: backdrop, panels, grades, lettering, export.
- `app/src/editor.js` — the editor wiring: uploads, panels, controls, export.
- `app/src/shots.js` — fixed `?shot=` scenes used for the screenshots.
- `app/fonts/Anton-Regular.ttf` — Anton by Vernon Adams, SIL Open Font
  License 1.1 (see `app/fonts/FONTS.md`).
- `app/samples/` — bundled sample photos, made with an image model.
- `main.ts` — the make.fun program: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `serve.ts` — a tiny static server for local testing.
- `screenshots/` — the four screenshots of the app and its covers.

## License

MIT — see [LICENSE](LICENSE).
