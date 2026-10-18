# The wizard, stage by stage

[Bahasa Indonesia](WIZARD.id.md) · [README](../README.md) · [Windows notes](WINDOWS.md)

The wizard is Claude Code following the instructions in this repository. You talk; it asks questions,
edits the house data, tests everything and shows you pictures. You never need to edit code.

**Before you start**
- **Node.js** 22 or newer recommended (20.19 is the minimum); **Claude Code** with a Pro, Max, Team,
  Enterprise or Console plan. On Windows, Git for Windows is recommended but not required.
- Open a terminal **in the repository folder** and start `claude` there once in the normal
  (interactive) way. When it asks whether you **trust this folder**, answer yes: only then does it use
  this repository's permission list, so the wizard can run its checks without asking you each time.
- Your plan and photos can stay where they are (e.g. `Downloads/denah rumah.jpg`, spaces are fine):
  tell the wizard the path or drag the file into the chat; it copies them into the project's private
  folder (`node scripts/import-files.mjs`).

**Tips**
- Answer the numbered questions by number ("1b, 2a, 3: 4 bedrooms"). "Up to you" is a fine answer — the
  wizard picks the recommended option and writes it down as an assumption you can change later.
- You can stop at any time. Next time type `/lanjut` (or `/continue`).
- You can always just type what you want: "make the kitchen bigger", "the sofa should face the window".
- In a hurry? Put your answers in the same message as the command, e.g. `/denah my plan is in
  Downloads/plan.jpg, the ceilings are standard, carport on the east`. The wizard then asks only what is
  still missing, uses the recommended option for the rest, and lists those choices in `progress.md`.
- Times below are for a normal laptop.

---

## 0. Setup — `/rumah-baru` (`/new-house`) · ~5 min
**You are asked:** a name for your house project (e.g. `our-house`).
**What happens:** installs the tools if needed, copies the blank template to `projects/<name>/`, starts
`progress.md`.
**Files:** `projects/<name>/` (new), `.active-project`.

## 1. Brief (interview) · 10–20 min
**You are asked** (in 6 short batches): what the project is and which plan you have (photo/scan/PDF,
hand sketch, or none); plot size and which side the road is; region/climate (city level is enough);
floors; who lives there; bedrooms and bathrooms; kitchen type; extra rooms; privacy, garden, daylight;
style; budget and region for a cost estimate (optional); which features you want.
**You won't be asked** for your address, names or security details.
**Files:** `projects/<name>/brief.md`, `progress.md`.
**Done when:** you confirm the summary.

## 2. Floor plan & zoning — `/denah` (`/floorplan`) · 20–60 min
**You give:** a photo, scan or PDF of a plan, or a photo of a hand sketch (put it in
`projects/<name>/private/plans/` or drag it into the chat) — or nothing, and the wizard designs from your
brief (it proposes two layouts).
**You are asked:** to confirm the scale and anything unreadable (one batch), then corrections after you
see the 2D plan ("bedroom 2 is 50 cm wider", "the door opens the other way").
**What happens:** rooms, walls, doors, windows and stairs are written as data, every door is walked
through automatically in both directions, and you get a 2D plan picture plus a room table with areas.
**Files:** the project's house/plan data, `progress.md`.
**Done when:** you approve the plan.

## 3. Style — `/gaya` (`/style`) · 10–20 min
**You give:** inspiration photos (`projects/<name>/private/inspo/` or in the chat).
**You are asked:** which room each photo is for, and **whether you took the photo or may use it** — only
those can become textures (e.g. a tile you photographed). All photos can guide the style.
**What happens:** a table per room (walls, floor, ceiling, wood, fabrics, metals, lighting, furniture
types) for you to approve; then finishes are applied and you see pictures.
**Files:** `projects/<name>/style.md`, interior data, optional textures.

## 4. Interior — `/interior` · 15–40 min
**You are asked:** priorities per room (bed size, dining seats, TV, desk, storage, kids, pets), what must
stay free.
**What happens:** every room is furnished with real sizes; doors, routes and clearances are checked; you
see pictures per room and correct by chat.
**Files:** interior data.

## 5. Exterior & site — `/eksterior` (`/exterior`) · 10–30 min
**You are asked:** façade style, roof, fence/gate, driveway & parking, garden, pool, privacy.
**What happens:** the outside is built; the route from the road to every outside door is checked; you see
street, garden and aerial pictures.
**Files:** exterior/site data.

## 6. Features — `/fitur` (`/features`) · 5–15 min
Turn on or off: doors that open, sitting, home lift · drivable cars · walking together online with voice
(needs your own free Supabase account) · spec numbers · cost estimate · photoreal bake (needs a graphics
card) · site & landscape. Walking, dollhouse, 2D plan and minimap are always on.
**Files:** project feature settings.

## 7. Lighting — `/pencahayaan` (`/lighting`) · ~5 min (+ bake 10 min–2 h)
Day and night pictures; lamps are added where rooms are too dark. If your computer has a capable graphics
card and you want it, the "bake" computes realistic still lighting (slow; redo after changes). Without a
graphics card this step is skipped — the house still looks good.

## 8. Spec & cost — `/spec-biaya` (`/spec-cost`) · 10–20 min
**You are asked:** region, quality level, who builds, what to include.
**What happens:** areas and quantities are measured from the model; the price table is adapted to your
region; you get a total **with a range** and a breakdown. It is an estimate for planning, not a quote.
**Files:** project rate table, generated quantities.

## 9. Preview & check — `/pratinjau` (`/preview`), `/cek` (`/check`) · 2–10 min
Opens the house in your browser (also on your phone on the same Wi-Fi). `/cek` runs every test and takes
screenshots; you get a plain report of what passed, what has problems and what was not tested.

## 10. Deploy — `/deploy` · 10–20 min the first time
Puts the house online on **your own** free Vercel account, optionally behind a PIN, so family and friends
can walk through it on their phones. You create the account and type the PIN into Vercel yourself — the
wizard never sees it. Your private photos are never uploaded.

---

## Files the wizard keeps for you
| File | What |
|---|---|
| `projects/<name>/progress.md` | where you are, decisions, open questions, last test results |
| `projects/<name>/brief.md` | your answers from the interview |
| `projects/<name>/style.md` | the agreed style per room + photo rights |
| `projects/<name>/private/` | your plans and photos (not uploaded, not in git) |
| `projects/<name>/shots/` | screenshots |
