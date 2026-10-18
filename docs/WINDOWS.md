# Windows notes

[Bahasa Indonesia](WINDOWS.id.md) · [README](../README.md)

Everything in house-3d-studio runs on Windows 10/11. The tools are Node-only, so the same `npm run …`
commands work in **PowerShell**, **Command Prompt (cmd)**, Windows Terminal and the VS Code terminal.
Every command on this page works in both PowerShell and cmd unless it says otherwise.

How to tell which one you are in: PowerShell shows `PS C:\Users\you>`, cmd shows `C:\Users\you>`
(no `PS`).

## Install (once)
1. **Node.js LTS** (22 or newer recommended; 20.19 at the least): https://nodejs.org → the "LTS"
   download → run the installer with the default options. Or: `winget install OpenJS.NodeJS.LTS`
2. **Git for Windows**: https://git-scm.com/downloads/win (default options). Or: `winget install Git.Git`
   You need Git to copy the template; Claude Code also uses its Git Bash when it is installed.
3. **Claude Code**: `winget install Anthropic.ClaudeCode`, or in PowerShell
   `irm https://claude.ai/install.ps1 | iex`. Official guide: https://code.claude.com/docs/en/setup
   (no Administrator rights needed). It needs a Claude Pro, Max, Team or Enterprise plan or an Anthropic
   Console account; the free Claude plan does not include Claude Code.
4. **Close and reopen** the terminal so it finds `node`, `npm`, `git` and `claude`. Check:
   ```
   node -v
   npm -v
   git --version
   claude --version
   ```

## Where to put the project
Use a short path **without spaces and outside OneDrive**, e.g. `C:\dev\my-house`.

PowerShell:
```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/<you>/my-house.git
cd my-house
npm install
claude
```
cmd: the same, but use `cd /d C:\dev` (plain `cd` in cmd does not switch drives if you start on `D:`).

OneDrive-synced folders (Documents, Desktop) can lock files during `npm install` and slow everything down.

## PowerShell execution policy
On many Windows PCs PowerShell refuses to run `npm` at first:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```
`npm` in PowerShell is a small script (`npm.ps1`), and Windows blocks scripts by default. Fix it once for
your user (no Administrator needed), in PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Answer `Y`. `RemoteSigned` lets scripts on your own PC run and still blocks unsigned scripts downloaded
from the internet. If you prefer not to change it, either type `npm.cmd` instead of `npm` in PowerShell
(`npm.cmd run dev`), or use cmd, where `npm` works without any change.

## Long paths
Windows limits paths to 260 characters unless long paths are switched on. The project itself is fine in a
short folder like `C:\dev\my-house`; problems show up as `Filename too long` (git) or `ENOENT` /
`EPERM` deep inside `node_modules` when the project sits in a long path.
1. First choice: move the project to a short folder (`C:\dev\my-house`).
2. Let Git handle long paths (PowerShell or cmd):
   ```
   git config --global core.longpaths true
   ```
3. Switch long paths on for Windows itself: open **PowerShell as Administrator** (Start → type
   PowerShell → *Run as administrator*) and run
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```
   then restart the PC. (Same as Group Policy → Computer Configuration → Administrative Templates →
   System → Filesystem → *Enable Win32 long paths*.)

## Slow `npm install` (Microsoft Defender)
Defender's real-time scan checks each of the thousands of small files `npm install` writes, which can
make it take many minutes. That is normal and only the first install is slow. To speed it up:
- Keep the project out of OneDrive (see above).
- On Windows 11, put your projects on a **Dev Drive** (Settings → System → Storage → Advanced storage
  settings → Disks & volumes → Create Dev Drive); Defender scans it in a lighter mode.
- Or exclude only your projects folder from scanning: Windows Security → Virus & threat protection →
  Manage settings → Exclusions → Add an exclusion → Folder → `C:\dev`. Exclude only a folder that holds
  your own projects, never a whole drive or your Downloads folder.

## Known quirks
| Problem | Fix |
|---|---|
| `'node' is not recognized` | Reopen the terminal after installing Node; if it persists, reinstall Node with "Add to PATH" ticked. |
| `running scripts is disabled on this system` (npm.ps1) | See [PowerShell execution policy](#powershell-execution-policy). |
| `npm run x -- --flag` ignores `--flag` (PowerShell) | Some PowerShell versions drop the `--`. Use `node scripts/x.mjs --flag`, or `npm.cmd run x -- --flag`, or run it in cmd. |
| Firewall popup when running `npm run dev` | Allow **Private networks** only. Needed to open the house from your phone on the same Wi-Fi. |
| `EPERM` / `EBUSY` during `npm install` | Close VS Code/Explorer windows on the folder, pause OneDrive, run `npm install` again. |
| `Filename too long`, long path errors | See [Long paths](#long-paths). |
| `npm install` takes ages | See [Slow npm install](#slow-npm-install-microsoft-defender). |
| Screenshots fail ("browser not found") | `npx playwright install chromium` (once). |
| Slow or black 3D view | Update the graphics driver; in Chrome/Edge → Settings → System → turn on "Use graphics acceleration"; in Windows Settings → System → Display → Graphics, set the browser to "High performance". Choose **Light** quality in the house's Options menu. |
| `claude` is not recognized | Close and reopen the terminal. If it persists, see https://code.claude.com/docs/en/troubleshoot-install. |
| Line ending warnings from git (`LF will be replaced by CRLF`) | Harmless; the repository's `.gitattributes` keeps files consistent. |

## Finding your graphics card (for the optional bake)
Task Manager (Ctrl+Shift+Esc) → Performance → GPU. NVIDIA GTX 1060 / RTX or AMD RX 5000+ is good for
baking; Intel/AMD integrated graphics: skip the bake. Everything else works.

## macOS and Linux
Same steps; install Node LTS from https://nodejs.org (macOS: or `brew install node`; Linux: your package
manager or `nvm`), Git, then Claude Code (`curl -fsSL https://claude.ai/install.sh | bash`). Commands are
identical. See the [README](../README.md#install).
