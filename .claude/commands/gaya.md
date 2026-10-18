---
description: "Gaya dari foto inspirasi: material, warna, furnitur per ruang / Style from inspiration photos: materials, colours, furniture per room"
argument-hint: "[folder foto / photo folder]"
---

# /gaya — style (stage 3)

Precondition: plan approved (stage 2). Use the `style-from-inspo` skill.

1. Ask where the photos are: `$ARGUMENTS`, `projects/<house>/private/inspo/`, or pasted in chat.
   Ask which room(s) or element (façade, roof, kitchen, bedroom…) each photo is for, if not obvious.
2. Ask about rights in the same batch: "Did you take these photos yourself or do you have permission to
   use them? Only those can become textures. All photos can still guide the style." Record the answer
   per photo in `style.md`.
3. Analyse → propose a per-room style table (walls, floor, ceiling, trim, joinery, fabrics, metals,
   lighting mood, furniture types from the catalogue). Offer 2 variations where the photos disagree.
4. After approval: write finishes into the interior data; generate textures only for permitted photos
   (`npm run textures`). Validate + check.
5. Screenshots of 3–4 key rooms; show and ask for adjustments.

Exit: `style.md` complete, user approved; `progress.md` updated; next = `/interior`.
