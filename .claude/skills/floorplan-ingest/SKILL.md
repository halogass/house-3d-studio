---
name: floorplan-ingest
description: Turn a floor plan photo, scan, PDF or hand sketch (or, without a plan, the brief) into zoning data for house-3d-studio - find the scale, snap rooms and walls to a 0.5 m / 0.25 m lattice, place doors and windows, and list every uncertainty as a question. Use in /denah (/floorplan) and whenever the user sends a plan image or asks to change the layout.
---

# floorplan-ingest

Goal: a room/opening model that matches the user's plan closely enough to walk through, with every guess
made visible. Output format: `docs/SCHEMA.md` (rooms as rectangles `r: [x0, y0, x1, y1]` in metres,
openings on room edges, levels with elevation and height, fixtures). Example: `projects/sample-house/`.

## 1. Read the source
- Images: open with the Read tool. If the photo is skewed or tiny, ask for a straighter/sharper photo
  only if you really cannot read it. PDFs: Read with `pages` (architectural sets: find the floor plan
  pages; ignore sections/elevations except for heights).
- Multi-floor: one image per floor; align them using the stair and outer walls.
- Note the north arrow and the road side if shown.

## 2. Find the scale (in this order)
1. Dimension labels/chains (e.g. "3000", "3.00", "300" → decide mm/cm/m from context; Indonesian plans
   usually use cm or mm). Use the **longest** labelled chain; cross-check with a second one.
2. A scale bar or "1:100" with a known paper size (PDF only).
3. Known objects: an interior door leaf ≈ 0.8–0.9 m (entrance 0.9–1.2 m), a single bed 0.9–1.0 × 2.0 m,
   queen 1.6 × 2.0 m, a WC ≈ 0.4 × 0.7 m, a stair step ≈ 0.25–0.30 m going, a parking bay ≈ 2.5 × 5 m.
   Use at least two objects; if they disagree by > 10 %, ask.
4. Hand sketch without numbers: ask for 2–3 key dimensions (overall width & depth, one room).
State the scale you used and the cross-check error ("scale from the 12.00 m front wall; the 3.00 m
bedroom label agrees within 2 %").

## 3. Trace and snap
- Set origin at the south-west (bottom-left) corner of the building or plot; `x` east (right), `y` north
  (up). If the plan's "up" is not north, keep plan-up = +y and record the true north angle separately (ask).
- Trace each room as one or more rectangles (L-shaped rooms = 2 rectangles of the same room or two rooms
  joined as open plan — follow SCHEMA). Measure to wall **centre lines**.
- Snap to a 0.5 m lattice; use 0.25 m only when 0.5 m would change a room by > 10 % or misplace a door.
  Record every snap > 10 cm in the uncertainty list.
- Walls: from room edges (engine generates them; exterior vs interior thickness per SCHEMA). Do not
  draw walls separately unless SCHEMA requires free walls (garden walls etc.).
- Openings: door width (default 0.9 interior, 1.0–1.2 entrance, 0.8 bathroom), swing side and hinge
  from the arc; sliding/folding/opening (no leaf) from the symbol; windows with width and (ask) sill.
  Measure an opening **between the wall ends** (the gap in the wall), not between the thin frame or
  glass lines drawn inside it — those make every window ~0.2–0.3 m too narrow. A door's width = the
  radius of its swing arc (two arcs: their sum). Prefer rounding to common sizes (0.7, 0.8, 0.9, 1.2,
  1.5, 1.8, 2.4 m) when the drawing is within ±5 cm.
- Dashed lines between rooms usually mean no wall (open plan / one space): model as an `open` pair.
- A plan drawn without the plot: ask where the house sits (setbacks front/side/back) and where the
  car, terrace and garden go; until answered, centre it with ≥ 1.5 m to the side boundaries and record
  that as an assumption.
- Hand sketches: lines wobble and sizes are rough; trust the written numbers over the drawing, snap to
  0.5 m, and ask for any key size that has no number.
- Stairs: footprint + direction; check riser 0.15–0.18 m, going ≥ 0.25 m, width ≥ 0.9 m; if the plan's
  stair cannot fit those, say so.
- Wet rooms: fixtures (WC, shower, sink, tub, kitchen counter) where drawn.
- Levels: floor-to-floor default 3.2–3.5 m (ground) / 3.0–3.2 m (upper); ask.

## 4. Sanity checks before writing
- Sum of room areas ≈ gross area minus walls (within ~10 %).
- Every room reachable: an opening chain from the entrance to every room.
- No room smaller than a usable minimum (bedroom ≥ 2.4 m side, bathroom ≥ 1.2 m side, corridor ≥ 0.9 m);
  flag, don't "fix" the user's plan silently.
- Doors not overlapping each other or a wall corner (keep ≥ 0.1 m from corners).

## 5. Uncertainties → one batch of questions
List as numbered questions with your proposed default, e.g.
"1. The kitchen width is unreadable — I used 3.5 m (from the 7.0 m total minus the 3.5 m dining). OK?"
Max ~6 per batch; the rest go to `progress.md` → Assumptions.

## 6. Without a plan (design from brief)
- Read `brief.md`. Decide plot, road side, orientation (living/terraces to the garden and good sun;
  in the tropics avoid big west glass; bedrooms quiet side), public → semi-private → private gradient,
  wet rooms stacked/back-to-back, one compact stair core, cross-ventilation (openings on opposite walls).
- Typical sizes: living 4×5–5×7 m, dining 3×4 m, kitchen 2.5×3.5 m+, master 4×4.5 m + bath 2×3 m +
  wardrobe, bedroom 3×3.5 m, bathroom 1.5×2.4 m, corridor 1.2 m, stair 1.1 × 4–5 m (straight) or
  2.4 × 3 m (U).
- Propose **two** alternatives (a compact and a more open one) as room tables + short pros/cons; write the
  chosen one, then iterate.

## 7. Write → test → show
Write data → `npm run validate` → `npm run check` → 2D plan screenshot + dollhouse (skill `qa-visual`).
Compare the 2D render with the source image side by side (Read both) and note differences. Show the
user the plan image, a room table (name, m × m, m²) and the totals. Corrections via chat; repeat.
