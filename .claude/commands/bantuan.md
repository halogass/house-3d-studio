---
description: "Bantuan: daftar perintah dan cara kerja wizard / Help: list of commands and how the wizard works"
argument-hint: "[topik / topic]"
---

# /bantuan — help

Answer in the user's language, short and friendly. If `$ARGUMENTS` names a topic, answer only that
(using `docs/WIZARD.md` / `docs/WIZARD.id.md`, `docs/WINDOWS.md`, `README.md` / `README.id.md`).
Otherwise show:

| Indonesia | English | What it does |
|---|---|---|
| `/rumah-baru` | `/new-house` | start a new house + interview |
| `/lanjut` | `/continue` | continue where you stopped |
| `/denah` | `/floorplan` | floor plan from photo/PDF/sketch or from the interview |
| `/gaya` | `/style` | style from inspiration photos |
| `/interior` | `/interior` | furniture per room |
| `/eksterior` | `/exterior` | façade, roof, garden, site |
| `/fitur` | `/features` | optional features |
| `/pencahayaan` | `/lighting` | day/night light, photoreal bake (GPU) |
| `/spec-biaya` | `/spec-cost` | area, energy, water, cost estimate |
| `/pratinjau` | `/preview` | open the 3D house on this computer |
| `/cek` | `/check` | test everything + screenshots |
| `/deploy` | `/deploy` | put it online (optional PIN) |
| `/bantuan` | `/house-help` | this help |

Then: "You can also just type what you want, e.g. 'make the kitchen bigger' / 'dapurnya dibesarkan'."
If a project exists, add one line with its current stage from `progress.md`.
