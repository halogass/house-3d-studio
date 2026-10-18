---
description: "Denah & zoning: baca foto/scan/PDF/sketsa denah atau rancang dari wawancara / Floor plan & zoning: read a plan photo/scan/PDF/sketch or design from the brief"
argument-hint: "[path ke file denah / path to plan file]"
---

# /denah — plan & zoning (stage 2)

Precondition: `brief.md` exists and was confirmed. If not, run the brief first (`/rumah-baru` step 1).
Read `docs/SCHEMA.md` (data format) and look at `projects/sample-house/` for a worked example.

## A. Input
- Plan file: `$ARGUMENTS` (a path; the rest of the arguments may be answers to the questions below),
  or files in `projects/<house>/private/plans/`, or images pasted in chat. A file outside the project:
  copy it first with `node scripts/import-files.mjs "<path>" --to plans`.
- PDFs: read with the Read tool (pages). Images: Read tool (vision).
- No plan: design from the brief.

## B. Produce zoning
Use the `floorplan-ingest` skill:
- with a plan → find the scale, trace rooms/walls/openings, snap to the lattice, list uncertainties;
- without a plan → propose 2 alternative zonings (sketch as a text table + 2D plan after writing data),
  respecting the brief (orientation to road and sun, public → private gradient, wet rooms stacked,
  stair position, daylight and cross-ventilation).

Before writing data, ask ONE batch of questions about the uncertainties (scale check, unclear walls,
door swings, window sizes, ceiling height, number of floors, where the house sits on the plot and
anything the brief wants that the plan does not show, e.g. a carport). Offer the default you would use.
Skip what the user already answered; if you cannot ask, use the defaults (CLAUDE.md rule 1).

## C. Write + test
1. Write levels/rooms/openings/fixtures into the project data (format: `docs/SCHEMA.md`).
2. `npm run validate` → `npm run check`. Fix every blocked door / route (route list: entrance → every room).
3. Render the 2D plan (studio plan view; skill `qa-visual`, "plan" viewpoint) and a dollhouse screenshot.
   Look at both yourself. Compare against the source plan: room count, proportions, door positions.
4. Show the user the 2D plan image + a short room table (name, size m × m, area m²) and the total area.
   Ask for corrections (chat). Apply → repeat C.

Report plan-to-model accuracy honestly: rooms and doors you could read exactly vs those you estimated.

## Exit
User says the plan is OK ("sudah oke" / "approved"). Record version (`plan v0.x`) and decisions in
`progress.md`; next step = `/gaya` (style) or `/eksterior` if they prefer the outside first.
