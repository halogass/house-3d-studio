---
name: brief-interview
description: Interview a non-programmer about the house they want in house-3d-studio - six batches of questions (site & land, people & rooms, lifestyle, style, budget & region, features) with options and sensible defaults, written to projects/<house>/brief.md. Use in /rumah-baru (/new-house) and when the brief needs to change.
---

# brief-interview

Rules: reply in the user's language; ask each batch in **one** message (AskUserQuestion when available,
otherwise a numbered list); 3–6 questions per batch; each with 2–4 options + "(recommended / disarankan)"
default + "other / lainnya". Skip questions already answered (e.g. from the plan image). Never ask for a
street address, GPS coordinates, names of family members, or details of security systems; region/city
and "number of adults/children" are enough.

## Batch 1 — the project & the land / proyek & lahan
1. What is this? existing house / planned build / renovation / dream (no real plot).
2. Plan input: photo/scan/PDF of a plan · hand sketch · no plan (design from the interview).
3. Plot size (W × D m) and which side faces the road. Default: 12 × 20 m, road south.
4. Climate/region (city or province level): tropical lowland · tropical highland · temperate · other.
   (Used for sun, ventilation advice, and later cost.)
5. Number of floors: 1 · 2 (default) · 3 · plus basement.

## Batch 2 — people & rooms / penghuni & ruang
1. Who lives there: adults, children (ages), elderly, staff, pets.
2. Bedrooms (default 3) and bathrooms (default 2–3); en-suite for the master? guest room?
3. Kitchen: open to living/dining (default) · closed · plus a separate wet/dirty kitchen (common in ID).
4. Extra rooms (multi-select): study/office · prayer room · laundry · storage · garage/carport (cars?) ·
   family room · gym · other.
5. Accessibility: stairs OK · need a ground-floor bedroom · wheelchair (wider doors 0.9–1.0 m, no steps).

## Batch 3 — lifestyle / gaya hidup
1. Daily life: cooking a lot? working from home? hosting guests often?
2. Privacy: open & airy · balanced (default) · very private from the street.
3. Outdoor: garden · terrace · pool · courtyard · vegetable garden · none.
4. Daylight & ventilation priority: high (default in the tropics) · normal.

## Batch 4 — style / gaya
1. Overall interior style: modern minimalist · warm modern / Japandi · tropical · classic / colonial ·
   industrial · Scandinavian · other.
2. Exterior style: same family as interior (default) · modern tropical · Mediterranean · classic · other.
3. Inspiration photos? (yes → `/gaya` later; explain rights for textures-from-photos.)
4. Colours they love / avoid.

## Batch 5 — budget & region / anggaran & daerah (optional, skip if the user doesn't care about cost)
1. Want a cost estimate? yes · later · no.
2. Quality level: simple · medium (default) · premium.
3. Currency/region for rates (default from Batch 1 region).

## Batch 6 — features / fitur
1. Doors that open, sit on sofas, lift (if any) — default yes.
2. Drivable car(s) in the garage — default no.
3. Walk together online with friends + voice (needs a free Supabase account) — default no.
4. Spec numbers (area, energy, water) — default yes.
5. Photoreal lighting bake (only with a gaming/graphics card) — default no.
6. Put it online with a PIN — later decision; default "later".

## Output — `projects/<house>/brief.md`
Write in the user's language, plain sentences, sections matching the batches, then:
- **Room program** table: room · approx. size · floor · notes.
- **Must-haves / nice-to-haves / avoid**.
- **Assumptions** (defaults you chose).
Show a 10–15 line summary; ask for confirmation; apply corrections; record "brief confirmed <date>" in
`progress.md`.
