---
description: "Pilih fitur opsional (pintu, duduk, lift, mobil, multiplayer, spec, biaya, bake, taman) / Toggle optional features"
argument-hint: "[nama fitur / feature name] [on|off]"
---

# /fitur — optional features (stage 6)

Flags live in `projects/<house>/project.json` → `features` (names and defaults: `docs/SCHEMA.md`,
`engine/schema.js` `FEATURES`): `doors`, `sit`, `lift`, `cars`, `multiplayer`, `spec`, `cost`, `bake`,
`site`, `garden`, `pv` (solar panels), `finishes`, `furniture`. Read the current values first.

Show a numbered table (user's language): feature — what it does — cost/impact — current state:
1. Core: walk, dollhouse, 2D plan, minimap — always on.
2. Doors that open, sit/lie on furniture, home lift (only if the house has one) — light; default ON.
3. Drivable cars — needs cars in the garage/driveway; medium load; default OFF.
4. Multiplayer + voice — walk together with friends; needs the user's **own free Supabase account**
   (skill `deploy-vercel` §Supabase); default OFF.
5. Spec (energy / water / area) — default ON (estimates, labelled).
6. Cost estimate with regional rates — skill `cost-region`; default OFF until `/spec-biaya`.
7. Photoreal bake — only with a capable GPU; skill `lighting-bake`; default OFF.
8. Site & landscape — default ON.

If `$ARGUMENTS` names a feature + on/off, just do that. Otherwise ask which to change (multi-select).
For each change: set the flag → `npm run validate` → `npm run test` → quick check in the browser or a
screenshot. Multiplayer: explain it works locally between two browser tabs without keys, and online only
after Supabase keys are set in Vercel. Record choices in `progress.md`.
