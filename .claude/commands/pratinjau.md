---
description: "Jalankan rumah 3D di komputer dan buka di browser / Run the 3D house locally and open it in the browser"
argument-hint: ""
---

# /pratinjau — preview locally

1. If a dev server is already running for this repo, reuse it. Else run `npm run dev` **in the background**
   and wait for the `Local:` line.
2. Give the user the `Local:` URL (to click) and the `Network:` URL (for a phone on the same Wi-Fi; on
   Windows allow Node through the firewall on private networks if asked).
   Do not try to open the browser with OS-specific commands; the user clicks the link.
3. Explain controls briefly in their language: click the view, WASD/arrows to walk, mouse to look,
   Shift run, M dollhouse, E doors/sit (if enabled), Esc to release the mouse; phone: left thumb walks,
   right thumb looks; minimap click = teleport; Options menu = time of day, month, quality.
4. Optionally take screenshots (skill `qa-visual`) to confirm it renders, and say whether you did.
5. Remind: stop with Ctrl+C in that terminal or ask you to stop it.

**Non-interactive session** (e.g. `claude -p`, a script, CI): a dev server started there keeps the
session from ending and stops with it, so the user could never open the link. Do not start it. Instead
confirm the house renders (`node scripts/screenshots.mjs --only street,aerial`, look at both) and give
the user the one command to run in their own terminal, `npm run dev`, plus what to open (`Local:` /
`Network:` lines) and how to stop it (Ctrl+C).
