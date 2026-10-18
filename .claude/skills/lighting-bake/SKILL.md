---
name: lighting-bake
description: Tune day and night lighting in house-3d-studio and, only when a capable GPU is present and the user wants it, run the photoreal light bake area by area with before/after checks. Use in /pencahayaan (/lighting) and when the user asks for more realistic lighting.
---

# lighting-bake

## 1. Real-time lighting first (works on any laptop)
- Screenshots of key rooms at 10:00 and 20:00 (skill `qa-visual`).
- Too dark at night → add lamps (ceiling + at least one table/floor lamp per living room/bedroom).
  Functional rooms (kitchen work zone, bathroom, garage, workshop) → neutral/cool white (4000–6500 K);
  living/bedrooms → warm (2700–3000 K).
- Note: the engine uses a limited pool of real-time lights near the player; many lamps are fine.

## 2. GPU check (before offering a bake)
Ask the user what graphics they have, and verify:
- Windows: Task Manager → Performance → GPU (name), or `dxdiag`.
- macOS: Apple menu → About This Mac (Apple Silicon M1+ is OK for small houses).
- Linux: `nvidia-smi` or `lspci`.
- In the browser (any OS): the app's quality/GPU info, or `chrome://gpu` shows "Hardware accelerated".
Rule of thumb: dedicated GPU (NVIDIA GTX 1060 / RTX, AMD RX 5xxx+) or Apple M-series → OK.
Integrated Intel/AMD → skip the bake (it would take many hours or fail). Say this honestly.

## 3. Bake (only if OK + user wants it)
- Explain: 10 min to 2 h depending on house size and GPU; the computer may get loud; don't use other 3D
  apps/screenshots meanwhile; any later geometry change in an area makes its bake stale.
- Read the bake options in `docs/ENGINE.md` / `node scripts/bake.mjs --help`. Start with one area at
  low samples to test, then the rest: `node scripts/bake.mjs --area <name>` / `--all` (background).
- After: screenshots day + night for each baked area; compare with before. If an area looks worse
  (too dark, blotchy, too warm), adjust its gain/lamps and re-bake, or disable the bake for that area and
  keep real-time lighting — record which.
- Check performance (FPS in the app on the user's laptop; phones should not get heavier).
- `npm run test` + `npm run build` after baking.

## 4. Record
`progress.md`: areas baked, sample count, duration, what was disabled and why, or "bake skipped: no GPU".
