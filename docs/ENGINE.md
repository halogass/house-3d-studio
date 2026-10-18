# Engine

Technical notes for whoever works on the engine (people or Claude). The house data format is in
[SCHEMA.md](SCHEMA.md); the wizard workflow in [WIZARD.md](WIZARD.md).

Stack: Vite 8 + three.js 0.186 (ES modules), plain JavaScript, no framework. Node ≥ 20.6, all
tooling in Node (works the same in cmd, PowerShell, bash, zsh).

## Layout

```
index.html            the 3D viewer page (boot guard, menus; texts filled in by engine/ui.js)
engine/               the engine (browser + Node)
  data.js             loads the active project (@project/…) and normalises it (schema.js)
  schema.js           defaults, normalisation, validate() with bilingual messages (pure JS)
  config.js           levels, ground level, stairs (stairs.js plans), lift, walking constants
  guard.js            first import of main.js: shows data errors on the page instead of a broken view
  main.js             renderer, sky/sun, modes, input, culling, quality tiers, staged build, lift UI, …
  assemble.js         shell + finishes + exterior + furniture; assemble() / assembleStaged()
  world.js            shell from the plan: floors, ceilings, walls with openings, stairs, lift shaft,
                      fixtures, roofs (hip / gable / shed / flat), PV, balconies, site (site.js)
  site.js             plot, perimeter, site items
  exterior.js         façade detailing, ridge caps, garden lights, photo vegetation collection
  stairs.js           stair plans (flights, landing, voids, balustrade edges)
  geom.js             geometry helpers (box, plane, hip/gable/shed roofs, wallRuns, weld, merge)
  physics.js          walking: flat / slope surfaces + AABB colliders + moving car boxes
  doors.js            animated doors and gates (instanced leaves), automatic gates
  lift.js             home lift (any door side, N stops)
  interact/           sit / lie / buttons / doors prompt (controller.js), seat slots (seats.js)
  drive/              drivable cars
  multi/              multiplayer: Supabase Realtime or BroadcastChannel, avatars, voice (WebRTC)
  interior/           finishes.js, place.js, furniture/ (100+ procedural types, 9 cars)
  render/             pipeline.js (GTAO, bloom, SMAA, adaptive scale), lights.js (point-light pool),
                      bake.js (+ bake-unwrap.js, bake-worker.js) baked lightmaps runtime
  bake/page.js        the GPU path tracer used by `npm run bake` (studio/bake.html)
  materials.js        material registry (+ textures.js canvas fallbacks, texture-files.js)
  garden/photo.js     photo vegetation (one mesh per garden cell, LOD by draw range)
  spec.js             "House spec" tab numbers
  cost/               quantities.js, calc.js, rates/<region>.js
  i18n.js             UI strings (id / en), tr() for data strings
studio/               plan.html (2D plan), cost.html (estimate), bake.html (dev only)
projects/<name>/      one house each (see SCHEMA.md); _template/ is copied by new-project
public/               textures (CC0), env HDRI (CC0), garden atlas (CC0), service worker
scripts/              Node tools (below); scripts/lib/ shared helpers; scripts/tests/ engine tests
middleware.js         optional PIN gate on Vercel (inert without SITE_PIN)
```

How the active project reaches the engine: `vite.config.js` aliases `@project` to
`projects/<active>/`; Node scripts call `useProject()` (scripts/lib/project.mjs), which registers a
module hook doing the same. One build = one house.

## Scripts

| npm run … | node scripts/… | what |
|---|---|---|
| `dev` | `dev.mjs [--port 5173]` | dev server (LAN reachable) |
| `build` | `build.mjs [--no-validate]` | validate, then `vite build` → `dist/` |
| `preview` | `preview.mjs [--port 4173]` | serve `dist/` |
| `validate` | `validate.mjs [--json] [--strict]` | schema check, bilingual messages |
| `check` | `check.mjs` | walkability: doors both ways, closed doors block, gates, stairs, balustrades, every room reachable |
| `check-interior` | `check-interior.mjs` | furniture layout rules (`DEBUG_PATH=1` prints the path grid of a failing door) |
| `test` | `test.mjs [--only name]` | validate + checks + scripts/tests/*.mjs on the active project and on the fixture house `scripts/tests/fixtures/mini-lift` (lift, straight stair, gable/shed roofs, road on the east, northern hemisphere) |
| `quantities` | `quantities.mjs` | `projects/<name>/quantities.json` + estimate summary |
| `textures` | `textures.mjs [--set name]` | WebP copies of photo textures (sharp) + `engine/texture-files.js` |
| `bake` | `bake.mjs --help` | photoreal lightmaps (GPU) |
| `screenshots` | `screenshots.mjs [--only …] [--rooms a,b] [--time 16] [--mobile]` | PNGs from fixed viewpoints → `projects/<name>/shots/` |
| `new-project` | `new-project.mjs <name> [--title …] [--lang id]` | copy `_template`, make active |
| `use-project` | `use-project.mjs [name]` | switch / list |
| `deploy` | `deploy.mjs [--prod]` | validate, then `npx vercel deploy` (preview; production with `--prod`) |
| | `catalogue.mjs` | regenerate the furniture / material catalogue in SCHEMA.md |

All of them accept `--project <name>`. On PowerShell `npm run x -- --flag` may drop the flags: use
`node scripts/x.mjs --flag`.

## URL parameters and the debug hook

The viewer reads (all optional):

| param | effect |
|---|---|
| `?at=x,y[,level[,yawDeg[,pitchDeg]]]` | start position (yaw 0 = looking north, 90 = east) |
| `?mode=house[&cut=L1]` | start in the dollhouse view, cut at a level (`all` = everything) |
| `?cam=x,y,h,tx,ty,th` | dollhouse camera at plan (x, y) height h, looking at (tx, ty, th) |
| `?time=14.5&month=3` | sun position (hour 5.5–19) |
| `?quality=low\|high\|ultra` | graphics tier (not remembered) |
| `?ui=0` | hide all panels (clean screenshots) |
| `?lang=id\|en` | language |
| `?staged=0\|1` | force the desktop (all at once) or phone (staged) build |
| `?bake=0\|1` | lightmaps off / on regardless of the feature flag |
| `?cull=0` · `?reach=24&decor=14&shadowReach=16` | culling off / culling distances (m) |
| `?dynres=0\|1` | adaptive resolution off / on |
| `?room=CODE` | join a multiplayer room |
| `?keepgeo` | keep CPU copies of geometry (debugging) |

`window.__dh` (after start): `teleport(x, y, level, yaw)`, `toggleMode('walk'|'house')`,
`setCut(level|'all')`, `player` `{x, y, e, yaw, pitch}`, `camera`, `orbit`, `currentLevel()`,
`roomAt(level, x, y)`, `doors` (`toggle(id)`, `openAll()`), `interact` (`act('E')`, `seated`),
`drive` (`cars`, `enter(car, 'driver')`, `exit()`), `lift`, `minimap`, `multi`, `pipe`, `renderer`,
`build` (`doneAt` set when the staged build has finished), `Z`, `PROJECT`.
`studio/plan.html?level=L1&furniture=1&grid=1&roofs=0` and `window.__plan` (`ready`, `setLevel(id)`);
`studio/cost.html` exposes `window.__cost` (`ready`, `Q`, `calc()`).

## Rendering and performance

- **Quality tiers** low / high / ultra (shadows off / 2048 / 4096 map; GTAO + bloom on high/ultra;
  SMAA). The tier starts from the device (phones low) and an FPS probe moves it up or down.
  Adaptive resolution (down to 60 %) on phones and the low tier.
- **Shadows**: the sun's frustum follows the visitor and is snapped to whole shadow-map texels (no
  crawling edges); the shadow map is redrawn only when something in it can have changed.
- **Geometry**: the shell is merged per (group, material); furniture per (level, room / open-plan
  cluster, material) with decor apart; all welded (indexed). CPU copies are dropped after upload.
- **Culling**: floors not in view are hidden (near a stair or lift the floors above and below stay;
  outside, all above-ground floors), furniture beyond ~24 m (phones 12 m) and small decor beyond
  14 m (8 m) is not drawn; parked cars cast shadows only nearby.
- **Shaders** are compiled in parallel before the first frame (`compileAsync`) with everything
  visible, so walking into a room never stalls.
- **Phones / tablets** (touch, iPadOS): staged build (shell first, then site and each level in
  ~10 ms slices, the visitor's level first), 512 px colour-only textures, fetched nearest first.
  Limits: keep a house ≲ 600 m² and ≲ 400 furniture items for mid-range phones; very large textures
  and many lamps cost most. A lost WebGL context reloads once, then explains what to do.
- **Boot guard** (index.html): retries a failed download, explains startup errors; **service
  worker** (`public/sw.js`) caches app bundles and textures for flaky connections (pages always
  from the network, so the PIN gate and new deploys apply).

## Optional parts

- **Doors / gates** (`features.doors`): closed at start; E, a click or a tap toggles; sliding gates
  with `auto` open for walkers and cars.
- **Sitting** (`features.sit`): sofas, chairs, stools, benches, beds (sit E, lie R).
- **Lift** (`zoning.lift`, `features.lift`).
- **Cars** (`features.cars`): car types in a garage room or a site area; arcade driving, 30 km/h on
  site, 12 km/h below grade; cars poke doors and gates open ahead of them.
- **Multiplayer** (`features.multiplayer`): with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (Vercel env / `.env.local`) peers meet over Supabase Realtime (broadcast + presence) in rooms
  named `h3s-<project>-<code>`; without them, tabs of the same browser (BroadcastChannel). Shared:
  positions, seats, doors, lift, time of day, pings (Q), follow (F), spatial voice (WebRTC; over
  mobile data set a TURN server: `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL`).
- **Spec tab** (`features.spec`): numbers from the model + `project.json` `spec` assumptions.
- **Cost** (`features.cost`): `studio/cost.html`, rates per region (SCHEMA.md).
- **Bake** (`features.bake`): `npm run bake` renders day + night lightmaps per area on the GPU
  (Windows: ANGLE Direct3D 11; macOS: Metal; Linux: OpenGL, `--gpu i` / `--gpus n` for NVIDIA
  PRIME offload). Without a GPU the bake is skipped. Output in `projects/<name>/bake/`, served at
  `/bake/`; the app ignores an area whose geometry changed since its bake. Typical: 2–10 min per
  level at 256 spp on a mid-range GPU. Options: `node scripts/bake.mjs --help`.
- **Site / garden** (`features.site`, `features.garden`): façade detail, lights and photo plants.

## Assets and licences

All textures, the HDRI and the garden atlas are CC0 (Poly Haven / ambientCG): see
`public/textures/CREDITS.md` and `public/garden/CREDITS.md`. Furniture and cars are procedural
(code). New textures: CC0 only, credited, converted with `npm run textures`.

## Adding things

- **A furniture type**: a builder `(params, mat) => THREE.Group` in `engine/interior/furniture/<module>.js`
  (local frame: origin on the floor at the footprint centre, +X width, +Y up, +Z front; set
  `group.userData = { type, w, d, h, solid, lights }`), its `INFO` entry, then
  `node scripts/catalogue.mjs` and `npm run test`.
- **A site item kind**: `engine/site.js` (shell), optionally `engine/exterior.js` (detail),
  `SITE_KINDS` in `engine/schema.js`, SCHEMA.md.
- **A UI string**: both languages in `engine/i18n.js`.
