# Çayxana Oyunları

Twenty-eight classic and casual games in one single-file web app, in English, Persian and Azerbaijani. Free to play.

Play it here: https://parlour-play.nazaninzeynabafrazy.workers.dev

## Files
- `index.html` — the live game (one file).
- `sw.js`, `manifest.webmanifest` — offline support and install-as-app settings.
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — the app icons.
- `privacy.html`, `credits.html` — privacy page and credits.
- `ads.html`, `head_lines.txt`, `build.py` — the game source and the script that builds `index.html`.
- `three.min.js` — 3D library (MIT licence) used by Jenga and Billiards.
- `worker.js`, `cloudflare-worker.js`, `wrangler.toml` — the Cloudflare Workers that serve the site and run the player counter and clans.
- `parlour-offline-noads.html` — the one-file offline version without ads.

## Notes
- The full source, fonts, icons and tests are in the latest source zip, kept by the developer.

© 2026 Çayxana Oyunları. All rights reserved.
