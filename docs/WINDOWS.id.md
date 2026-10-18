# Catatan Windows

[English](WINDOWS.md) · [README](../README.id.md)

Semua bagian house-3d-studio berjalan di Windows 10/11. Alatnya hanya memakai Node, jadi perintah
`npm run …` sama persis di PowerShell, Windows Terminal, dan terminal VS Code.

## Instalasi (sekali saja)
1. **Node.js LTS** (versi 20.6 atau lebih baru; disarankan 22 LTS): https://nodejs.org → "LTS" → jalankan
   installer dengan opsi bawaan. Atau di PowerShell: `winget install OpenJS.NodeJS.LTS`
2. **Git for Windows**: https://git-scm.com/download/win (opsi bawaan). Claude Code di Windows
   membutuhkannya. Atau: `winget install Git.Git`
3. **Claude Code**: ikuti panduan resmi https://code.claude.com/docs/en/setup (installer Windows).
   Anda butuh langganan Claude (Pro ke atas) atau akun API Anthropic.
4. **Tutup lalu buka lagi** terminal agar `node`, `npm`, `git`, dan `claude` dikenali. Cek:
   ```powershell
   node -v
   npm -v
   git --version
   ```

## Letak folder proyek
Pakai path pendek **tanpa spasi dan di luar OneDrive**, mis. `C:\dev\rumah-saya`:
```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/<anda>/<repo-rumah-anda>.git rumah-saya
cd rumah-saya
npm install
claude
```
Folder yang disinkron OneDrive (Documents, Desktop) bisa mengunci file saat `npm install` dan membuat
semuanya lambat.

## Masalah yang sering muncul
| Masalah | Solusi |
|---|---|
| `'node' is not recognized` | Buka ulang terminal setelah memasang Node; bila masih, pasang ulang Node dengan opsi "Add to PATH". |
| `running scripts is disabled on this system` (npm.ps1) | Jalankan sekali: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` — atau pakai `npm.cmd` sebagai ganti `npm`. |
| `npm run x -- --flag` mengabaikan `--flag` | Windows PowerShell kadang "memakan" `--`. Pakai `node scripts/x.mjs --flag`, atau `npm.cmd run x -- --flag`. |
| Muncul pop-up firewall saat `npm run dev` | Izinkan **Private networks** saja — perlu untuk membuka rumah dari HP di Wi-Fi yang sama. |
| `EPERM` / `EBUSY` saat `npm install` | Tutup VS Code/Explorer yang membuka folder itu, jeda OneDrive atau pemindaian antivirus, ulangi `npm install`. |
| Error path terlalu panjang | Pakai path pendek (mis. `C:\dev\rumah-saya`), atau aktifkan long paths: `git config --global core.longpaths true`. |
| Screenshot gagal ("browser not found") | `npx playwright install chromium` (sekali). |
| Tampilan 3D lambat atau hitam | Perbarui driver grafis; di pengaturan Chrome/Edge → System → aktifkan "Use graphics acceleration"; di Windows Settings → Display → Graphics, atur browser ke "High performance". |
| Peringatan git tentang line ending (`LF will be replaced by CRLF`) | Tidak berbahaya. |

## Mengetahui kartu grafis (untuk bake opsional)
Task Manager (Ctrl+Shift+Esc) → Performance → GPU. NVIDIA GTX 1060 / RTX atau AMD RX 5000+ cocok untuk
bake; grafis terintegrasi Intel/AMD: lewati bake — fitur lain tetap jalan.

## macOS dan Linux
Langkahnya sama; pasang Node LTS dari https://nodejs.org (macOS: atau `brew install node`; Linux: package
manager atau `nvm`), Git, lalu Claude Code. Perintahnya identik.
