# Archived original media

Full-resolution originals of the images and animations used on the site, kept
for future re-editing. They are **not** part of the published site: GitHub
Pages builds with Jekyll, which skips any top-level directory whose name starts
with an underscore, so nothing in `_archive/` is uploaded or downloadable by
visitors.

If the site is ever switched to a workflow that copies the repository verbatim
(for example a "static HTML" GitHub Actions deploy), add an explicit exclude for
this folder, or the originals will start shipping again.

| Archived original | Shipped as |
| --- | --- |
| `images/profile.jpg` (3648×4560, 3.0 MB) | `images/profile.webp` + a resized `images/profile.jpg` for social previews |
| `images/research.jpg` (2500×1667, 1.6 MB) | `images/research.webp` |
| `images/spotlight/flying_squirrel.gif` (640×480, 33.6 MB) | `images/spotlight/flying_squirrel.mp4` / `.webm` + `.webp` poster |
| `images/spotlight/XPRIZE-drone.png` (754×630, 567 KB) | `images/spotlight/XPRIZE-drone.webp` |
| `images/spotlight/IMAV-2024-Drone-Competition.png` (768×576, 861 KB) | `images/spotlight/IMAV-2024-Drone-Competition.webp` |
| `images/group/fernando.png`, `images/group/kangle.jpeg` | renamed to `.webp` (the files were already WebP, just mislabelled) |
