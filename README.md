# house-3d-studio

**Design your house by chatting — then walk through it in 3D in your browser.**

[Bahasa Indonesia](README.id.md) · [Wizard guide](docs/WIZARD.md) · [Windows notes](docs/WINDOWS.md) · [Contributing](CONTRIBUTING.md)

house-3d-studio is a template you copy once per house. Inside it, **Claude Code** acts as a friendly
wizard: it interviews you, reads your floor plan (a photo, a scan, a PDF or a hand sketch — or designs one
with you), dresses the rooms in the style of your inspiration photos, tests that every door and route
works, and gives you a 3D house you can walk through on a laptop or phone. If you like, it puts it online
behind a PIN so family and friends can visit.

You don't need to be a programmer. You talk; the wizard does the files.

<!-- SCREENSHOTS: to be added after the sample house is rendered.
     docs/images/walk.webp      — first-person view in the living room
     docs/images/dollhouse.webp — dollhouse view
     docs/images/plan.webp      — 2D plan
     docs/images/phone.webp     — on a phone -->
> Screenshots coming soon.

## What you get
- **Walk** through every room (keyboard + mouse, or touch on a phone/tablet), **dollhouse** view,
  **2D plan**, **minimap** with teleport, time of day and month (sun position).
- Optional: doors that open, sitting on furniture, a home lift, drivable cars, **walking together online
  with voice**, spec numbers (area, energy, water), a **regional cost estimate**, **photoreal baked
  lighting** (needs a graphics card), garden and site.
- Everything is generated from simple data files, so any change you ask for is rebuilt and re-tested in
  seconds.

## Requirements
- A laptop or desktop with Windows 10/11, macOS or Linux. A graphics card is **optional** (only for the
  photoreal bake).
- **Node.js LTS** 20.6 or newer (22 LTS recommended) — https://nodejs.org
- **Git** — https://git-scm.com
- **Claude Code** with a Claude subscription (Pro or higher) or an Anthropic API account —
  https://code.claude.com/docs/en/setup
- A free GitHub account (to copy the template) and, only to put it online, a free Vercel account.

## Install
**Windows** (PowerShell) — see [docs/WINDOWS.md](docs/WINDOWS.md) for details:
```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
Then install Claude Code from the setup guide above and **reopen the terminal**.

**macOS** (Terminal): install Node LTS from nodejs.org (or `brew install node`), Git (`xcode-select --install`
or `brew install git`), then Claude Code.

**Linux**: install Node LTS (package manager or `nvm`), Git, then Claude Code.

Check (same on every system):
```
node -v
git --version
claude --version
```

## Quick start
1. On GitHub, click **Use this template → Create a new repository**. Choose **Private** — your house
   plan is personal.
2. Clone your new repository and install (same commands in PowerShell and bash):
   ```
   git clone https://github.com/<you>/<your-house-repo>.git my-house
   cd my-house
   npm install
   ```
   Windows tip: use a short folder outside OneDrive, e.g. `C:\dev\my-house`.
3. Start Claude Code in that folder:
   ```
   claude
   ```
4. Type **`/new-house`** (or **`/rumah-baru`** in Indonesian) and answer the questions.
5. Any time later: **`/continue`** (`/lanjut`) picks up where you stopped.

Want to look first? `npm run use-project sample-house` then `npm run dev`, and open the `Local:` link.

## The wizard in one table
| Step | Command (EN / ID) | You do | Takes |
|---|---|---|---|
| Start + interview | `/new-house` · `/rumah-baru` | answer ~6 short batches of questions | 15–25 min |
| Floor plan | `/floorplan` · `/denah` | give a plan photo/PDF/sketch, or none; correct the 2D plan | 20–60 min |
| Style | `/style` · `/gaya` | give inspiration photos; approve the style per room | 10–20 min |
| Interior | `/interior` | say what each room needs; correct by chat | 15–40 min |
| Exterior & site | `/exterior` · `/eksterior` | pick façade, roof, garden | 10–30 min |
| Features | `/features` · `/fitur` | switch extras on/off | 5–15 min |
| Lighting | `/lighting` · `/pencahayaan` | approve day/night; bake only with a GPU | 5 min (+ bake) |
| Spec & cost | `/spec-cost` · `/spec-biaya` | give region + quality | 10–20 min |
| Preview / check | `/preview` · `/pratinjau`, `/check` · `/cek` | look and walk | 2–10 min |
| Put online | `/deploy` | create a Vercel account, set a PIN | 10–20 min |
| Help | `/house-help` · `/bantuan` | — | — |

Details: [docs/WIZARD.md](docs/WIZARD.md). You can also just type what you want ("make the kitchen bigger").

## Privacy
- Your plans and photos stay on your computer in `projects/<house>/private/` — that folder is never
  committed to git and never deployed.
- The wizard never asks for your address, family names or security details, and never uploads your photos.
- Keep your copy of the repository **Private** on GitHub. Anyone with your site link **and** PIN can see
  the layout of your house — share the PIN carefully.
- Photos become textures only if you confirm you took them or may use them.
- PINs and keys are typed into Vercel by you; they are never stored in the repository or the chat.

## GPU note
Everything works on a normal laptop with built-in graphics. The **photoreal bake** is optional and needs a
real graphics card (e.g. NVIDIA GTX 1060 / RTX, AMD RX 5000+, or Apple M-series for small houses); it takes
10 minutes to 2 hours. Phones and tablets get a lighter quality level automatically.

## Putting it online
`/deploy` walks you through it: a free Vercel account, a one-time login from your computer, an optional
PIN, optional multiplayer keys (your own free Supabase project), and a check that the site works.

## Useful commands
You rarely need these — the wizard runs them — but they work the same in PowerShell and bash:

| Command | What |
|---|---|
| `npm run dev` | run the house locally (open the `Local:` link; the `Network:` link works on your phone on the same Wi-Fi) |
| `npm run validate` / `npm run check` / `npm run test` | check data, walk every door, run tests |
| `npm run new-project <name>` / `npm run use-project <name>` | new house / switch house |
| `npm run build` / `npm run preview` | production build / preview it |

## FAQ
**Do I need to know how to code?** No. You chat; the wizard edits and tests the files.

**Does it cost money?** The template is free (MIT). You need Claude Code (a Claude plan or API usage).
Vercel and Supabase free tiers are enough for a family house.

**My plan is a blurry phone photo.** Usually fine. The wizard reads dimension labels or known sizes (doors,
beds) to find the scale and asks about anything unclear. A straight, well-lit photo helps.

**I have no plan.** Choose "no plan"; the wizard designs two layouts from your answers.

**Can I edit by dragging walls?** Not yet — corrections are made by chat, and you see a new 2D plan and
pictures each time.

**Is the cost estimate a quote?** No. It is a planning estimate with a range, adapted to your region. Ask
a local contractor or quantity surveyor before deciding.

**It is slow or black on my tablet.** Choose the light quality level in Options; see
[troubleshooting in CLAUDE.md](CLAUDE.md#8-troubleshooting).

**Can I design two houses?** One copy per house is simplest. For a second house, make another copy of the
template.

**How do I get template updates?** Changes to the engine can be pulled in from the template repository
with git; ask Claude Code to help ("update the engine from the template").

## Licence and credits
MIT — see [LICENSE](LICENSE). Built with [three.js](https://threejs.org), [Vite](https://vite.dev),
[sharp](https://sharp.pixelplumbing.com), [Playwright](https://playwright.dev), optional
[Supabase](https://supabase.com) and [Vercel](https://vercel.com). Textures and environment maps are CC0
(see the credits files under `public/`). The wizard runs on [Claude Code](https://code.claude.com) by Anthropic.
