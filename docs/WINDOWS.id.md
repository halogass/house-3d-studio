# Catatan Windows

[English](WINDOWS.md) · [README](../README.id.md)

Semua bagian house-3d-studio berjalan di Windows 10/11. Alatnya hanya memakai Node, jadi perintah
`npm run …` sama persis di **PowerShell**, **Command Prompt (cmd)**, Windows Terminal, dan terminal
VS Code. Setiap perintah di halaman ini jalan di PowerShell maupun cmd, kecuali disebutkan lain.

Cara tahu Anda di mana: PowerShell menampilkan `PS C:\Users\anda>`, cmd menampilkan `C:\Users\anda>`
(tanpa `PS`).

## Instalasi (sekali saja)
1. **Node.js LTS** (disarankan 22 atau lebih baru; minimal 20.19): https://nodejs.org → unduhan "LTS" →
   jalankan installer dengan opsi bawaan. Atau: `winget install OpenJS.NodeJS.LTS`
2. **Git for Windows**: https://git-scm.com/downloads/win (opsi bawaan). Atau: `winget install Git.Git`
   Git diperlukan untuk menyalin template; Claude Code juga memakai Git Bash-nya bila terpasang.
3. **Claude Code**: `winget install Anthropic.ClaudeCode`, atau di PowerShell
   `irm https://claude.ai/install.ps1 | iex`. Panduan resmi: https://code.claude.com/docs/en/setup
   (tidak perlu hak Administrator). Butuh paket Claude Pro, Max, Team, atau Enterprise, atau akun Console
   Anthropic; paket Claude gratis tidak termasuk Claude Code.
4. **Tutup lalu buka lagi** terminal agar `node`, `npm`, `git`, dan `claude` dikenali. Cek:
   ```
   node -v
   npm -v
   git --version
   claude --version
   ```

## Letak folder proyek
Pakai path pendek **tanpa spasi dan di luar OneDrive**, mis. `C:\dev\rumah-saya`.

PowerShell:
```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/<anda>/rumah-saya.git
cd rumah-saya
npm install
claude
```
cmd: sama, tetapi pakai `cd /d C:\dev` (`cd` biasa di cmd tidak pindah drive bila Anda mulai di `D:`).

Folder yang disinkron OneDrive (Documents, Desktop) bisa mengunci file saat `npm install` dan membuat
semuanya lambat.

## Execution policy PowerShell
Di banyak PC Windows, PowerShell awalnya menolak menjalankan `npm`:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```
Di PowerShell, `npm` adalah skrip kecil (`npm.ps1`), dan Windows memblokir skrip secara bawaan. Perbaiki
sekali untuk akun Anda (tidak perlu Administrator), di PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Jawab `Y`. `RemoteSigned` mengizinkan skrip di PC Anda sendiri dan tetap memblokir skrip tanpa tanda
tangan yang diunduh dari internet. Bila tidak ingin mengubahnya, ketik `npm.cmd` sebagai ganti `npm` di
PowerShell (`npm.cmd run dev`), atau pakai cmd, tempat `npm` langsung jalan.

## Path panjang
Windows membatasi path sampai 260 karakter kecuali long paths diaktifkan. Proyek ini aman di folder
pendek seperti `C:\dev\rumah-saya`; masalah muncul sebagai `Filename too long` (git) atau `ENOENT` /
`EPERM` jauh di dalam `node_modules` bila proyek ada di path yang panjang.
1. Pilihan pertama: pindahkan proyek ke folder pendek (`C:\dev\rumah-saya`).
2. Izinkan Git memakai path panjang (PowerShell atau cmd):
   ```
   git config --global core.longpaths true
   ```
3. Aktifkan long paths untuk Windows: buka **PowerShell sebagai Administrator** (Start → ketik
   PowerShell → *Run as administrator*) lalu jalankan
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```
   lalu restart PC. (Sama dengan Group Policy → Computer Configuration → Administrative Templates →
   System → Filesystem → *Enable Win32 long paths*.)

## `npm install` lambat (Microsoft Defender)
Pemindaian real-time Defender memeriksa ribuan file kecil yang ditulis `npm install`, sehingga bisa makan
waktu beberapa menit. Itu normal dan hanya instalasi pertama yang lambat. Untuk mempercepat:
- Jauhkan proyek dari OneDrive (lihat di atas).
- Di Windows 11, simpan proyek di **Dev Drive** (Settings → System → Storage → Advanced storage
  settings → Disks & volumes → Create Dev Drive); Defender memindainya dengan mode yang lebih ringan.
- Atau kecualikan folder proyek saja dari pemindaian: Windows Security → Virus & threat protection →
  Manage settings → Exclusions → Add an exclusion → Folder → `C:\dev`. Kecualikan hanya folder yang berisi
  proyek Anda sendiri, jangan seluruh drive atau folder Downloads.

## Masalah yang sering muncul
| Masalah | Solusi |
|---|---|
| `'node' is not recognized` | Buka ulang terminal setelah memasang Node; bila masih, pasang ulang Node dengan opsi "Add to PATH". |
| `running scripts is disabled on this system` (npm.ps1) | Lihat [Execution policy PowerShell](#execution-policy-powershell). |
| `npm run x -- --flag` mengabaikan `--flag` (PowerShell) | Beberapa versi PowerShell membuang `--`. Pakai `node scripts/x.mjs --flag`, atau `npm.cmd run x -- --flag`, atau jalankan di cmd. |
| Muncul pop-up firewall saat `npm run dev` | Izinkan **Private networks** saja. Perlu untuk membuka rumah dari HP di Wi-Fi yang sama. |
| `EPERM` / `EBUSY` saat `npm install` | Tutup VS Code/Explorer yang membuka folder itu, jeda OneDrive, ulangi `npm install`. |
| `Filename too long`, error path panjang | Lihat [Path panjang](#path-panjang). |
| `npm install` lama sekali | Lihat [npm install lambat](#npm-install-lambat-microsoft-defender). |
| Screenshot gagal ("browser not found") | `npx playwright install chromium` (sekali). |
| Tampilan 3D lambat atau hitam | Perbarui driver grafis; di Chrome/Edge → Settings → System → aktifkan "Use graphics acceleration"; di Windows Settings → System → Display → Graphics, atur browser ke "High performance". Pilih kualitas **Ringan** di menu Opsi rumah. |
| `claude` tidak dikenali | Tutup dan buka lagi terminal. Bila masih, lihat https://code.claude.com/docs/en/troubleshoot-install. |
| Peringatan git tentang line ending (`LF will be replaced by CRLF`) | Tidak berbahaya; `.gitattributes` di repositori menjaga file tetap konsisten. |

## Mengetahui kartu grafis (untuk bake opsional)
Task Manager (Ctrl+Shift+Esc) → Performance → GPU. NVIDIA GTX 1060 / RTX atau AMD RX 5000+ cocok untuk
bake; grafis terintegrasi Intel/AMD: lewati bake. Fitur lain tetap jalan.

## macOS dan Linux
Langkahnya sama; pasang Node LTS dari https://nodejs.org (macOS: atau `brew install node`; Linux: package
manager atau `nvm`), Git, lalu Claude Code (`curl -fsSL https://claude.ai/install.sh | bash`). Perintahnya
identik. Lihat [README](../README.id.md#instalasi).
