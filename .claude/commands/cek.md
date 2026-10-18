---
description: "Cek kesehatan proyek: validasi, uji jalan, tes, screenshot / Check the project: validate, walkability, tests, screenshots"
argument-hint: "[cepat|lengkap / quick|full]"
---

# /cek — check everything

Run, in order, from the repo root (stop and report at the first hard failure, but still run validate + check):
1. `npm run validate`
2. `npm run check`
3. `npm run check-interior`
4. `npm run test`
5. `npm run build` (only for `lengkap` / `full`, or before deploy)
6. Screenshots with the `qa-visual` skill: `quick` = plan + dollhouse + entrance; `full` = every viewpoint.
   Look at every image before reporting.

Report in the user's language, plain words, as:
- **OK**: what passed (with counts, e.g. "42 doors walked both ways").
- **Problems**: each with location ("bedroom 2 door is blocked by the wardrobe") and your proposed fix.
- **Not tested**: e.g. phone/tablet, real GPU bake, multiplayer with a second person, deploy.
Ask before fixing anything that changes the design (moving walls, removing items). Pure bug-level fixes
(an item 5 cm inside a wall) you may fix directly, then re-run the checks.
Update `progress.md` → *Last checks*.
