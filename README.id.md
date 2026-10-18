# house-3d-studio

**Rancang rumah Anda sambil mengobrol — lalu jelajahi dalam 3D di browser.**

[English](README.md) · [Panduan wizard](docs/WIZARD.id.md) · [Catatan Windows](docs/WINDOWS.id.md) · [Kontribusi](CONTRIBUTING.md)

house-3d-studio adalah template yang Anda salin satu kali untuk satu rumah. Di dalamnya, **Claude Code**
bertindak sebagai wizard yang ramah: mewawancarai Anda, membaca denah Anda (foto, scan, PDF, atau sketsa
tangan — atau merancangnya bersama Anda), menata ruang sesuai foto inspirasi, menguji bahwa setiap pintu
dan jalur bisa dilewati, lalu memberi Anda rumah 3D yang bisa dijelajahi di laptop atau HP. Bila mau,
wizard juga mengonlinekannya dengan PIN agar keluarga dan teman bisa berkunjung.

Anda tidak perlu bisa memprogram. Anda cukup mengobrol; wizard yang mengurus file.

<!-- SCREENSHOT: ditambahkan setelah rumah contoh dirender.
     docs/images/walk.webp      — tampilan orang pertama di ruang keluarga
     docs/images/dollhouse.webp — tampilan dollhouse
     docs/images/plan.webp      — denah 2D
     docs/images/phone.webp     — di HP -->
> Screenshot segera menyusul.

## Yang Anda dapat
- **Berjalan** ke setiap ruang (keyboard + mouse, atau sentuh di HP/tablet), tampilan **dollhouse**,
  **denah 2D**, **minimap** dengan teleport, jam dan bulan (posisi matahari).
- Opsional: pintu yang bisa dibuka, duduk di furnitur, lift rumah, mobil yang bisa dikendarai,
  **jelajah bareng online dengan suara**, angka spesifikasi (luas, energi, air), **estimasi biaya sesuai
  daerah**, **pencahayaan bake fotorealistik** (perlu kartu grafis), taman dan tapak.
- Semuanya dibangun dari file data sederhana, jadi setiap perubahan yang Anda minta langsung dibangun
  ulang dan dites ulang dalam hitungan detik.

## Kebutuhan
- Laptop atau PC dengan Windows 10/11, macOS, atau Linux. Kartu grafis **opsional** (hanya untuk bake
  fotorealistik).
- **Node.js LTS** 20.6 atau lebih baru (disarankan 22 LTS) — https://nodejs.org
- **Git** — https://git-scm.com
- **Claude Code** dengan langganan Claude (Pro ke atas) atau akun API Anthropic —
  https://code.claude.com/docs/en/setup
- Akun GitHub gratis (untuk menyalin template) dan, hanya untuk online, akun Vercel gratis.

## Instalasi
**Windows** (PowerShell) — detail di [docs/WINDOWS.id.md](docs/WINDOWS.id.md):
```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
Lalu pasang Claude Code dari panduan di atas dan **buka ulang terminal**.

**macOS** (Terminal): pasang Node LTS dari nodejs.org (atau `brew install node`), Git
(`xcode-select --install` atau `brew install git`), lalu Claude Code.

**Linux**: pasang Node LTS (package manager atau `nvm`), Git, lalu Claude Code.

Cek (sama di semua sistem):
```
node -v
git --version
claude --version
```

## Mulai cepat
1. Di GitHub, klik **Use this template → Create a new repository**. Pilih **Private** — denah rumah Anda
   bersifat pribadi.
2. Clone repositori baru Anda lalu pasang (perintah sama di PowerShell dan bash):
   ```
   git clone https://github.com/<anda>/<repo-rumah-anda>.git rumah-saya
   cd rumah-saya
   npm install
   ```
   Tips Windows: pakai folder pendek di luar OneDrive, mis. `C:\dev\rumah-saya`.
3. Jalankan Claude Code di folder itu:
   ```
   claude
   ```
4. Ketik **`/rumah-baru`** (atau **`/new-house`** dalam bahasa Inggris) lalu jawab pertanyaannya.
5. Kapan pun nanti: **`/lanjut`** melanjutkan dari titik terakhir.

Mau lihat contoh dulu? `npm run use-project sample-house` lalu `npm run dev`, dan buka link `Local:`.

## Wizard dalam satu tabel
| Langkah | Perintah (ID / EN) | Yang Anda lakukan | Waktu |
|---|---|---|---|
| Mulai + wawancara | `/rumah-baru` · `/new-house` | menjawab ±6 kelompok pertanyaan singkat | 15–25 menit |
| Denah | `/denah` · `/floorplan` | memberi foto/PDF/sketsa denah, atau tidak; mengoreksi denah 2D | 20–60 menit |
| Gaya | `/gaya` · `/style` | memberi foto inspirasi; menyetujui gaya per ruang | 10–20 menit |
| Interior | `/interior` | menyebut kebutuhan tiap ruang; koreksi lewat chat | 15–40 menit |
| Eksterior & tapak | `/eksterior` · `/exterior` | memilih fasad, atap, taman | 10–30 menit |
| Fitur | `/fitur` · `/features` | menyalakan/mematikan fitur tambahan | 5–15 menit |
| Pencahayaan | `/pencahayaan` · `/lighting` | menyetujui siang/malam; bake hanya dengan GPU | 5 menit (+ bake) |
| Spec & biaya | `/spec-biaya` · `/spec-cost` | memberi daerah + tingkat kualitas | 10–20 menit |
| Pratinjau / cek | `/pratinjau` · `/preview`, `/cek` · `/check` | melihat dan berjalan-jalan | 2–10 menit |
| Online | `/deploy` | membuat akun Vercel, memasang PIN | 10–20 menit |
| Bantuan | `/bantuan` · `/house-help` | — | — |

Detail: [docs/WIZARD.id.md](docs/WIZARD.id.md). Anda juga boleh langsung mengetik keinginan ("dapurnya dibesarkan").

## Privasi
- Denah dan foto Anda tetap di komputer Anda, di `projects/<rumah>/private/` — folder itu tidak pernah
  masuk git dan tidak pernah di-deploy.
- Wizard tidak pernah menanyakan alamat, nama keluarga, atau detail keamanan, dan tidak pernah
  mengunggah foto Anda.
- Simpan salinan repositori Anda sebagai **Private** di GitHub. Siapa pun yang punya link situs **dan**
  PIN bisa melihat tata letak rumah Anda — bagikan PIN dengan hati-hati.
- Foto hanya dijadikan tekstur bila Anda mengonfirmasi bahwa Anda memotretnya sendiri atau punya izin.
- PIN dan kunci Anda ketik sendiri di Vercel; tidak pernah disimpan di repositori atau di chat.

## Catatan GPU
Semua fitur jalan di laptop biasa dengan grafis bawaan. **Bake fotorealistik** bersifat opsional dan
butuh kartu grafis sungguhan (mis. NVIDIA GTX 1060 / RTX, AMD RX 5000+, atau Apple M-series untuk rumah
kecil); prosesnya 10 menit sampai 2 jam. HP dan tablet otomatis memakai kualitas yang lebih ringan.

## Mengonlinekan
`/deploy` memandu Anda: akun Vercel gratis, login sekali dari komputer, PIN opsional, kunci multiplayer
opsional (proyek Supabase gratis milik Anda sendiri), dan pengecekan bahwa situsnya berjalan.

## Perintah yang berguna
Jarang perlu — wizard yang menjalankannya — tapi sama di PowerShell dan bash:

| Perintah | Fungsi |
|---|---|
| `npm run dev` | menjalankan rumah di komputer (buka link `Local:`; link `Network:` bisa dibuka di HP pada Wi-Fi yang sama) |
| `npm run validate` / `npm run check` / `npm run test` | cek data, lewati setiap pintu, jalankan tes |
| `npm run new-project <nama>` / `npm run use-project <nama>` | rumah baru / pindah rumah |
| `npm run build` / `npm run preview` | build produksi / pratinjau hasilnya |

## Tanya jawab
**Perlu bisa coding?** Tidak. Anda mengobrol; wizard yang mengubah dan menguji file.

**Apakah berbayar?** Template ini gratis (MIT). Anda perlu Claude Code (paket Claude atau pemakaian API).
Paket gratis Vercel dan Supabase cukup untuk rumah keluarga.

**Denah saya cuma foto HP yang buram.** Biasanya tetap bisa. Wizard membaca angka ukuran atau benda yang
ukurannya diketahui (pintu, kasur) untuk mencari skala, dan menanyakan bagian yang tidak jelas. Foto yang
lurus dan terang sangat membantu.

**Saya tidak punya denah.** Pilih "tidak ada denah"; wizard merancang dua alternatif dari jawaban Anda.

**Bisa mengedit dengan menarik dinding?** Belum — koreksi dilakukan lewat chat, dan setiap kali Anda
mendapat denah 2D dan gambar baru.

**Apakah estimasi biaya itu penawaran harga?** Bukan. Itu estimasi perencanaan dengan rentang, disesuaikan
dengan daerah Anda. Tanyakan ke kontraktor atau QS setempat sebelum memutuskan.

**Lambat atau hitam di tablet.** Pilih kualitas ringan di menu Opsi; lihat
[pemecahan masalah di CLAUDE.md](CLAUDE.md#8-troubleshooting).

**Bisa merancang dua rumah?** Paling mudah satu salinan untuk satu rumah. Untuk rumah kedua, buat salinan
template lagi.

**Bagaimana mendapat pembaruan template?** Perubahan engine bisa ditarik dari repositori template dengan
git; minta bantuan Claude Code ("perbarui engine dari template").

## Lisensi dan kredit
MIT — lihat [LICENSE](LICENSE). Dibuat dengan [three.js](https://threejs.org), [Vite](https://vite.dev),
[sharp](https://sharp.pixelplumbing.com), [Playwright](https://playwright.dev), opsional
[Supabase](https://supabase.com) dan [Vercel](https://vercel.com). Tekstur dan environment map berlisensi
CC0 (lihat file kredit di `public/`). Wizard berjalan di [Claude Code](https://code.claude.com) buatan Anthropic.
