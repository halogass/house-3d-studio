---
description: "Eksterior & tapak: fasad, atap, taman, pagar, jalan masuk / Exterior & site: façade, roof, garden, fence, driveway"
argument-hint: ""
---

# /eksterior — exterior & site (stage 5)

Precondition: plan approved. Use the `exterior-site` skill.

1. One batch of questions: façade style (offer 3 from photos/brief), roof type (pitched/hip/flat/mixed)
   and material, plot size & road side (if not in the brief), fence/gate, driveway & parking, garden
   (lawn, trees, pool, terrace), privacy from the road. Defaults from `brief.md` / `style.md`.
2. Write exterior/site data → `npm run validate` → `npm run check` (driveway → entrance → every outside
   door must stay walkable).
3. Screenshots: street view, garden view, aerial/dollhouse, dusk. Look first, then show.
4. Corrections via chat → repeat.

Exit: user approves outside look; checks green; `progress.md` updated.
