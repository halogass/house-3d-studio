---
description: "Mulai rumah baru: buat proyek dari template lalu wawancara / Start a new house: create a project from the template, then the brief interview"
argument-hint: "[nama-rumah / house-name]"
---

# /rumah-baru — start a new house (stage 0 + 1)

Reply in the user's language (Indonesian if they used `/rumah-baru` or write Indonesian, English otherwise).
Follow `CLAUDE.md` golden rules.

## Step 0 — setup (stage 0)
1. Check tools quietly: `node -v` (22+ recommended, 20.19 minimum), and that `node_modules/` exists. If not, run `npm install`
   (tell the user it takes 1–3 minutes). If Node is missing, stop and point them to `README.md` → Install.
2. List `projects/`. If a non-sample project already exists, ask: continue that one (`/lanjut`) or start
   another (one copy of the repo is meant for one house — a second house is fine for experiments).
3. Project name: the first word of `$ARGUMENTS` if given (the rest of the arguments may be the user's
   answers to the interview: use them, CLAUDE.md rule 1), else propose one (e.g. `rumah-kami` / `our-house`) and confirm.
   Normalise to lowercase `a-z0-9-`. Do not put a family name or address in it unless the user insists.
4. `npm run new-project <name>` (creates `projects/<name>/` from `projects/_template/` and makes it active).
   If the command is refused (permission prompt declined, or "workspace not trusted" in a
   non-interactive run), tell the user plainly how to allow it (start `claude` once interactively in this
   folder and accept "trust"); only as a last resort copy the template files with Read/Write, create
   `private/plans/` and `private/inspo/`, write `.active-project`, and say so.
5. Create/refresh `projects/<name>/progress.md` from the template (`projects/_template/progress.md`, else
   `docs/wizard/progress.template.md`): set `house`, `language`, `stage: brief`, `updated`.
6. Tell the user in 3–4 lines what will happen (brief → plan → style → interior → exterior → features →
   lighting → cost → preview → deploy), that they can stop at any time and resume with `/lanjut`, and that
   their data stays on their computer unless they deploy.

## Step 1 — brief interview (stage 1)
Use the `brief-interview` skill. Ask the batches it defines (site & land, people & rooms, lifestyle,
style, budget & region, features). Batch questions with options and defaults.

Also ask early (in batch 1) which plan input they have:
1. photo / scan / PDF of a floor plan,
2. a hand sketch (photo),
3. no plan — design from the interview.
If they have a file, it can stay where it is: take its path (or a dragged-in image) and copy it with
`node scripts/import-files.mjs "<path>" --to plans` (inspiration photos: `--to inspo`). Quote paths
with spaces. You will read it in `/denah`.

## Exit
- `projects/<name>/brief.md` written (plain language, the user's language).
- Show a short summary (10–15 lines) and ask "Is this right? / Sudah sesuai?". Apply corrections.
- Update `progress.md`: stage 0 + 1 `[x]`, decisions, assumptions, next step = "`/denah` — plan & zoning".
- End with: "Next: `/denah` (or `/lanjut`)."
