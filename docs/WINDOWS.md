# Windows notes

[Bahasa Indonesia](WINDOWS.id.md) · [README](../README.md)

Everything in house-3d-studio runs on Windows 10/11. The tools are Node-only, so the same `npm run …`
commands work in PowerShell, Windows Terminal and the VS Code terminal.

## Install (once)
1. **Node.js LTS** (version 20.6 or newer; 22 LTS recommended): https://nodejs.org → "LTS" → run the
   installer with default options. Or in PowerShell: `winget install OpenJS.NodeJS.LTS`
2. **Git for Windows**: https://git-scm.com/download/win (default options). Claude Code on Windows needs
   it. Or: `winget install Git.Git`
3. **Claude Code**: follow the official setup guide, https://code.claude.com/docs/en/setup (Windows
   installer). You need a Claude subscription (Pro or higher) or an Anthropic API account.
4. **Close and reopen** the terminal so it finds `node`, `npm`, `git` and `claude`. Check:
   ```powershell
   node -v
   npm -v
   git --version
   ```

## Where to put the project
Use a short path **without spaces and outside OneDrive**, e.g. `C:\dev\my-house`:
```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/<you>/<your-house-repo>.git my-house
cd my-house
npm install
claude
```
OneDrive-synced folders (Documents, Desktop) can lock files during `npm install` and slow everything down.

## Known quirks
| Problem | Fix |
|---|---|
| `'node' is not recognized` | Reopen the terminal after installing Node; if it persists, reinstall Node with "Add to PATH" ticked. |
| `running scripts is disabled on this system` (npm.ps1) | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` — or use `npm.cmd` instead of `npm`. |
| `npm run x -- --flag` ignores `--flag` | Windows PowerShell can swallow `--`. Use `node scripts/x.mjs --flag`, or `npm.cmd run x -- --flag`. |
| Firewall popup when running `npm run dev` | Allow **Private networks** only — needed to open the house from your phone on the same Wi-Fi. |
| `EPERM` / `EBUSY` during `npm install` | Close VS Code/Explorer windows on the folder, pause OneDrive or antivirus scan, run `npm install` again. |
| Long path errors | Keep the project path short (e.g. `C:\dev\my-house`), or enable long paths: `git config --global core.longpaths true`. |
| Screenshots fail ("browser not found") | `npx playwright install chromium` (once). |
| Slow or black 3D view | Update the graphics driver; in Chrome/Edge settings → System → turn on "Use graphics acceleration"; in Windows Settings → Display → Graphics, set the browser to "High performance". |
| Line endings warnings from git (`LF will be replaced by CRLF`) | Harmless. |

## Finding your graphics card (for the optional bake)
Task Manager (Ctrl+Shift+Esc) → Performance → GPU. NVIDIA GTX 1060 / RTX or AMD RX 5000+ is good for
baking; Intel/AMD integrated graphics: skip the bake — everything else works.

## macOS and Linux
Same steps; install Node LTS from https://nodejs.org (macOS: or `brew install node`; Linux: your package
manager or `nvm`), Git, then Claude Code. Commands are identical.
