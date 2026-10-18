---
name: qa-visual
description: Take screenshots of a house-3d-studio project with Playwright from fixed viewpoints (2D plan, dollhouse, entrance, each room, street, garden, aerial, day and night) and inspect them for visual defects before showing the user. Use after every data change, in /cek (/check), and whenever results are reported.
---

# qa-visual

## Tooling (in order of preference)
1. The project's screenshot script if `package.json` has one (e.g. `npm run test` with shots, or
   `node scripts/screenshots.mjs`) — read `docs/ENGINE.md` for its options (viewpoint list, output dir).
2. Playwright directly: start `npm run dev` in the background (or `npm run preview` after a build), then a
   small Node script using `playwright` / `playwright-core` (`chromium.launch()`), or the Playwright MCP
   browser tools if available. First time only: `npx playwright-core install chromium`.
   Use the engine's debug hook / URL parameters (documented in `docs/ENGINE.md`) to teleport the camera,
   set the floor, time of day and dollhouse/plan mode — never rely on simulated key presses for position.
Save images to `projects/<house>/shots/<date>-<name>.png` (git-ignore if the user prefers).
Viewport 1280×800 (desktop) and 390×844 (phone) for the phone check.

## Fixed viewpoints
- `plan` — 2D plan of each floor (studio plan view).
- `dollhouse` — dollhouse/aerial of the whole house, each floor.
- `entrance` — eye level (1.6 m) outside the front door facing it.
- `room:<id>` — eye level from the main door looking in, plus the opposite corner looking back.
- `street` — from the road, 15–25 m away; `garden` — from the garden towards the house; `aerial`.
- `night` — living room + exterior at 20:00. `day` — at 10:00.

## What to look for (look at every image with the Read tool)
- Holes/gaps in walls, floors, roofs; z-fighting (flickering stripes); objects floating or sunk;
  furniture through walls or doors; items facing the wrong way (sofa facing the wall).
- Blocked doors, doors opening into furniture, stairs without headroom.
- Black or blown-out rooms; missing lamps at night; harsh shadows.
- Empty-looking rooms vs the agreed style; wrong materials/colours vs `style.md`.
- Phone view: UI overlaps, unreadable text, framerate warnings.
- Browser console errors (collect them; report the count and first lines).

## Report
List defects with viewpoint + location + proposed fix. Show the user only after you looked; pick the
3–6 most informative images. State what wasn't covered (e.g. "no phone screenshot", "night not checked").
Note: a background/occluded browser window can be throttled — bring the page to front before measuring FPS.
