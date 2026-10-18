---
description: "Pencahayaan siang/malam; bake fotorealistik bila ada GPU / Day/night lighting; photoreal bake if a GPU is available"
argument-hint: "[area]"
---

# /pencahayaan — lighting (stage 7)

Use the `lighting-bake` skill.
1. Screenshot key rooms at day (10:00) and night (20:00). Look for rooms that are too dark, harsh, or
   missing lamps. Propose fixes (extra lamps, warmer/cooler light per room type) and apply after OK.
2. Detect GPU capability (skill). Explain plainly: bake = slower, prettier still lighting, takes
   10 min–2 h, needs a real graphics card, must be redone after layout changes in that area.
3. Only if GPU OK **and** user wants it: run `npm run bake` (background), area by area or all; then
   screenshots again, compare before/after, check FPS isn't worse. If an area looks worse, keep it
   un-baked and say so.
4. No GPU: skip the bake, keep real-time lighting, record "bake skipped: no GPU" in `progress.md`.
