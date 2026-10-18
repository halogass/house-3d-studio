---
name: interior-layout
description: Furnish rooms in house-3d-studio within the docs/SCHEMA.md interior rules - place catalogue furniture with correct front direction, clearances and door swings so the interior check passes, add finishes, lamps and decor at a cozy density. Use in /interior and for any furniture change.
---

# interior-layout

Read first: `docs/SCHEMA.md` (interior section: item format, rotation convention, wall/ceiling mounts,
material names, furniture catalogue), `brief.md`, `style.md`. Example: the sample project's interior data.

## Placement rules
- Coordinates are plan metres; an item's `x, y` is its footprint centre (wall items: on the inner wall
  face; ceiling items: below the fixture) — confirm the exact convention in SCHEMA.
- `rot` = the direction the item's FRONT faces (seat, bed foot, cabinet doors, TV screen). Check SCHEMA
  for the angle convention; when in doubt place one item, screenshot, verify, then do the rest.
- Inner wall face = room edge minus half the wall thickness (exterior vs interior walls differ).
- Keep clear: door swing arcs + 0.9 m in front of every door; main walkways ≥ 0.9 m (≥ 1.2 m preferred);
  0.6 m beside beds; 0.8–1.0 m in front of wardrobes/kitchen runs (1.0–1.2 m between counter and island);
  0.75 m behind dining chairs; nothing below 2.2 m inside an opening.
- Windows: no tall items in front of windows (≤ sill height only).
- Bathrooms: WC centre ≥ 0.4 m from side walls, 0.6 m free in front.
- Real sizes: seat 0.45 m, table 0.75 m, counter 0.9 m; beds single 0.9–1.0 × 2.0, queen 1.6 × 2.0,
  king 1.8–2.0 × 2.0; dining 0.6 m width per seat.

## Composition (cozy, not empty)
- Each living space: an anchor (sofa/bed/table), a rug that ties the group, side surfaces, at least two
  light sources (ceiling + lamp), something on the walls (art, shelves, mirror), a plant where light allows.
- Bedrooms: bed on the wall opposite or beside the door (not directly in line with it if possible),
  nightstands + lamps, wardrobe, optional chair.
- Avoid wall-hugging everything; float the sofa group when the room is > 4.5 m.
- Use bare-wall / density helpers if the engine provides them (see `package.json` scripts).

## Workflow
1. Per room: list intended items (type, size, material) → place → next room.
2. After each floor: `npm run validate` → `npm run check` (doors, routes) → `npm run check-interior`
   (clearances). Fix
   every reported problem by moving/resizing items, not by removing doors.
3. Screenshots per room (skill `qa-visual`): check floating items, clipping into walls, wrong facing,
   blocked doors, lamps without light, too-empty corners.
4. Show 3–6 images + a short per-room list to the user; apply corrections.

## Parallel
For big houses split by floor/wing and use the `interior-designer` agent, one per part, each owning only
its room ids. Merge and run the checks in the main session.
