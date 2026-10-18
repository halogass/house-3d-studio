---
name: exterior-site
description: Design the outside of the house in house-3d-studio - facade materials, roof form, windows, fence and gate, driveway and parking, garden, terraces, pool and planting - keeping every outside route walkable. Use in /eksterior (/exterior) and for any site or landscape change.
---

# exterior-site

Read: `docs/SCHEMA.md` (exterior/site/roof/landscape sections), `brief.md`, `style.md`, sample project.

## Questions (one batch, defaults from brief/style)
1. Façade: 3 options from the photos/brief (e.g. white plaster + timber, stone base + plaster, exposed
   brick), with the recommended one.
2. Roof: pitched gable · hip · flat with parapet · mixed; material (clay/concrete tile, metal, membrane);
   overhang (tropics: 0.8–1.2 m recommended).
3. Plot edges: fence/wall height and type, gate type, privacy screen from the road.
4. Driveway & parking: carport/garage, number of cars, turning space.
5. Garden: lawn, trees (shade side), terrace, pool (size), vegetable garden, paths, outdoor lighting.

## Rules
- Keep the road → gate → entrance route and all outside doors walkable (`npm run check`).
- Trees and walls must not block windows the user wants open, or a car's path.
- Car space: bay 2.5 × 5.0 m, driveway ≥ 3.0 m, ramp ≤ 15 % (≤ 12 % preferred).
- Pool: default 3 × 8 m, 1.2–1.5 m deep, shallow end if children; fence/cover note if small children.
- Planting: big trees ≥ 3 m from the house; use the engine's plant/tree types only (see SCHEMA).
- Mobile performance: prefer few large ground areas over many tiny pieces; trees are expensive — keep
  counts moderate (engine limits in `docs/ENGINE.md`).
- Security features (cameras, guard post, high walls): only if the user asks; remind them a shared link
  shows the layout.

## Workflow
Write data → `npm run validate` → `npm run check` → screenshots (street, garden, aerial, dusk; skill
`qa-visual`) → look → show → corrections. Update `progress.md`.
