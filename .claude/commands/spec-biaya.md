---
description: "Spesifikasi (luas, energi, air) & estimasi biaya sesuai daerah / Spec (area, energy, water) & regional cost estimate"
argument-hint: "[daerah / region]"
---

# /spec-biaya — spec & cost (stage 8)

Use the `cost-region` skill.
1. `npm run quantities` (areas, wall/floor/roof quantities, openings, fixtures).
2. Ask one batch: region (province/city or country, `$ARGUMENTS` if given), quality level
   (simple / medium / premium), who builds (contractor / small builder / self-managed), year/currency,
   what to include (land? furniture? cars? solar?).
3. Adapt the rate table for the region (skill) in `project.json` → `cost` (`index`, `rates`, `extra`,
   `label`), clearly marking which rates are sourced vs estimated; then `npm run quantities` again so the
   cost page and `quantities.json` show the adapted numbers. Items the 3D model does not measure (e.g.
   wall tiles drawn as paint) go in `cost.extra`.
4. Show: total with a range (e.g. ±15–25%), breakdown by group, area summary, energy/water spec, and the
   main assumptions. Always say it is an estimate, not a quote; suggest asking a local QS/contractor.
5. Record region, basis and totals in `progress.md`. Re-run quantities after any later plan change.
