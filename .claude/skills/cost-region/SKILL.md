---
name: cost-region
description: Produce an honest, region-adapted construction cost estimate and spec (area, energy, water) for a house-3d-studio project - regenerate quantities, adapt the rate table to the user's region, quality and year, and label every number as an estimate with a range. Use in /spec-biaya (/spec-cost) or when the user asks what the house would cost.
---

# cost-region

## 1. Quantities
`npm run quantities` → areas per floor/room, wall/floor/roof/ceiling areas, openings, fixtures, MEP items.
Re-run after any plan change; mention if the cost page is older than the plan.

## 2. Rate table
- The project's rate file (see `docs/SCHEMA.md`, copied from the template) has rates per unit (m², m, item,
  lump sum) with fields like region, year, currency, source, confidence. Never silently reuse rates from a
  different region.
- Ask: region (province/city or country), quality (simple / medium / premium), builder type
  (contractor with overhead + profit / small builder / self-managed), year, what is included (land,
  permits, furniture, appliances, solar, landscaping, design fees, VAT/tax).
- Adapting:
  1. Start from the template's base rates.
  2. Apply a regional factor: ask the user if they know a local price per m² for a typical house of this
     quality; derive the factor from it. If they don't know, use a clearly labelled assumption and ask them
     to confirm with a local contractor.
  3. Indonesia: rates differ a lot between Java cities, other islands and remote areas; local government
     unit-price lists (HSPK/AHSP) and contractor quotes are the best sources — suggest them, don't invent
     official numbers.
  4. Mark each rate: `sourced` (user/official/quote), `estimated` (your assumption).
- Use the currency's normal formatting (e.g. Rp 1.250.000.000; $1,250,000).

## 3. Output
- Total with a range (default ±15 % for medium confidence, ±25 % if most rates are estimated).
- Breakdown by group (structure, walls, roof, finishes, doors/windows, MEP, kitchen/bath, exterior/site,
  optional systems), area summary (gross/net per floor), cost per m².
- Spec: energy (lighting, AC, appliances → daily kWh; solar size if relevant), water (people × L/day,
  tank size), areas. Every load/consumption is an **estimate**.
- Assumptions and exclusions list. Always end with: "This is an estimate for planning, not a quote. Ask a
  local quantity surveyor or contractor before deciding."

## 4. Record
`progress.md`: region, quality, year, total + range, confidence, date. Never write a real address.
