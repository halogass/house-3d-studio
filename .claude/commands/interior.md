---
description: "Isi interior: furnitur & tata letak per ruang / Interior: furniture and layout per room"
argument-hint: "[ruang / room id]"
---

# /interior — interior layout (stage 4)

Precondition: plan approved; style agreed (or the user accepts default style). Use the `interior-layout` skill.

1. Ask one batch: priorities per room (e.g. bed size, dining seats, TV or not, desk, storage needs,
   kids' ages, pets), anything that must stay free (walkways, wheelchair), and whether to furnish all
   rooms now or one floor at a time. Offer defaults from `brief.md`.
2. If `$ARGUMENTS` names a room, do only that room.
3. Large house (> ~15 rooms): split by floor/wing and use the `interior-designer` agent per part,
   each owning only its part. Then integrate and run checks in the main session.
4. Write items + finishes → `npm run validate` → `npm run check` (doors, routes) → `npm run check-interior` (clearances).
5. Screenshots per room (skill `qa-visual`) — look for floating/clipping items, blocked doors,
   empty-looking rooms. Fix, then show the user 3–6 images and a short list per room.
6. Apply corrections from chat, repeat.

Exit: every room furnished or marked intentionally empty; checks green; user satisfied. Update `progress.md`.
