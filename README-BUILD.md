# The Parlour — how to build

Everything needed is in this folder. No other files are required.

- `ads.html`        the ONE source of the whole game hub (edit this)
- `new.html`        page shell used for the web version
- `head_lines.txt`  the first lines (doctype / head) shared by the builds
- `webpkg/`         the website folder (icons, fonts, privacy, credits, sw.js, manifest)
- `build.py`        run:  `mkdir -p out && python3 build.py`

Result:
- `out/parlour-online.html`       online build, ads off
- `out/parlour-online-gems.html`  online build, ads + gems on
- `out/parlour-offline*.html`     single-file offline builds
- `webpkg/index.html`             the file Cloudflare serves (upload `webpkg/` to GitHub)

Before each release change the cache name in `webpkg/sw.js` (e.g. parlour-v75 -> parlour-v76).

## Tests
`npm i playwright` once, then after building: `sh tests/run-all.sh`
(checks all 26 games at 6 screen sizes and in 3 languages, and that 18 games survive closing the page).
