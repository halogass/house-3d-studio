---
name: style-from-inspo
description: Analyse the user's inspiration photos for house-3d-studio and turn them into a per-room style - finishes, materials, colours, furniture types from the catalogue, facade and roof style - and, only for photos the user owns or has rights to, WebP textures made with sharp. Use in /gaya (/style), /interior and /eksterior when photos are involved.
---

# style-from-inspo

## 1. Collect + rights
- Photos from `projects/<house>/private/inspo/` (any sub-folders), pasted images, or a folder the user
  names. Never download photos from the web on the user's behalf; links are fine only if the user pastes
  the image itself.
- Ask once, per photo or per group: **"Did you take this photo, or do you have permission to use it?"**
  - yes → may be used for **style and textures**;
  - no / unsure → **style only** (colours, materials, layout ideas). Never crop it into a texture.
  Record in `style.md` → *Photo rights* table (file name · used for · rights: own / permitted / style-only).
- Keep `private/` out of deploys and out of public commits (CLAUDE.md rule 4).

## 2. Analyse (Read each image)
For every photo note: room type; walls (paint colour / panelling / wainscot / wallpaper / tile / stone);
floor (wood species & tone, tile, stone, concrete); ceiling (flat / tray + cove / beams / coffered);
trim & mouldings; joinery colour; main fabrics and leathers; metals (black iron, brass, chrome);
lighting mood (warm 2700 K / neutral 4000 K; chandeliers, pendants, lamps, cove); furniture types and
arrangement (e.g. "L-sofa facing TV wall, rug under front legs, two armchairs"); plants; façade
materials (plaster, stone, brick, timber), roof (pitch, colour, material), window frames.
Estimate colours as hex values; say they are approximate.

## 3. Map to the catalogue
- Use only material names and furniture types the engine knows: read the material registry and furniture
  catalogue listed in `docs/SCHEMA.md` (and `docs/ENGINE.md`). If something is missing, choose the
  closest and tell the user ("closest available: olive velvet").
- Paint and joinery colours can be any hex if SCHEMA supports colour factories (e.g. `paint:#rrggbb`).

## 4. Propose
A table per room: walls · floor · ceiling · trim · joinery · fabrics · metals · light · key furniture ·
source photo(s). Plus exterior row(s): façade · roof · windows · fence/gate · garden mood.
Where photos conflict, offer 2 options. Ask for approval in one batch.

## 5. Textures from photos (owned/permitted photos only)
- Purpose: a real tile, stone, wood, fabric or wallpaper the user photographed.
- Crop a flat, evenly lit, front-on area (no perspective, no furniture), at least 512 px.
- Make it tileable if possible (mirror/blend edges) and record its real-world size (ask: "about how big is
  one tile/plank?").
- Convert with `npm run textures` (sharp → WebP, mobile sizes). If the script needs a manifest entry,
  follow `docs/SCHEMA.md`. Keep each texture ≤ ~300 KB (1024 px) and ≤ ~80 KB (512 px mobile).
- Never make textures from people, faces, artworks, logos or brand items.

## 6. Write + check
Write finishes into the interior/exterior data → `npm run validate` → `npm run check` →
screenshots of 3–4 rooms (skill `qa-visual`) → compare with the photos side by side → show the user.
Update `style.md` and `progress.md`.
