---
description: "Lanjutkan dari langkah terakhir (baca progress.md) / Continue where you left off (reads progress.md)"
argument-hint: "[nama-rumah / house-name]"
---

# /lanjut — continue

1. Find the active project: `$ARGUMENTS` if given; else the active project in `.active-project` (set by
   `npm run use-project <name>`); else the only folder in `projects/`
   other than `_template` and `sample-house`. If several, ask which one (numbered list). If none, suggest
   `/rumah-baru`.
2. Read `projects/<house>/progress.md` fully. Also skim `brief.md` and `style.md` if present.
3. Re-verify the project is healthy before resuming: `npm run validate` and `npm run check`. If red,
   fixing that is the next step (tell the user plainly).
4. Greet briefly in the language stored in `progress.md` (or of the user's message), summarise in 3–5 lines:
   what is done, open questions, the next step.
5. If there are open questions in progress.md, ask them first (one batch, with options).
6. Then run the next stage exactly as its command describes (`.claude/commands/<stage>.md`):
   brief → `rumah-baru` (step 1) · plan → `denah` · style → `gaya` · interior → `interior` ·
   exterior → `eksterior` · features → `fitur` · lighting → `pencahayaan` · cost → `spec-biaya` ·
   preview → `pratinjau` · deploy → `deploy`.
   If every stage is done or skipped, offer: changes/revisions, `/cek`, `/pratinjau`, `/deploy`.
7. Update `progress.md` at the end.
