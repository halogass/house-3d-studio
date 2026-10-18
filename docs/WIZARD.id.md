# Wizard, tahap demi tahap

[English](WIZARD.md) · [README](../README.id.md) · [Catatan Windows](WINDOWS.id.md)

Wizard adalah Claude Code yang mengikuti petunjuk di repositori ini. Anda cukup mengobrol; wizard
bertanya, mengubah data rumah, menguji semuanya, lalu menunjukkan gambar. Anda tidak perlu menyentuh kode.

**Tips**
- Jawab pertanyaan bernomor dengan nomornya ("1b, 2a, 3: 4 kamar"). "Terserah" juga boleh — wizard
  memilih opsi yang disarankan dan mencatatnya sebagai asumsi yang bisa Anda ubah nanti.
- Anda bisa berhenti kapan saja. Lain kali ketik `/lanjut`.
- Anda selalu boleh mengetik keinginan langsung: "dapurnya dibesarkan", "sofanya menghadap jendela".
- Perkiraan waktu di bawah untuk laptop biasa.

---

## 0. Persiapan — `/rumah-baru` · ±5 menit
**Ditanyakan:** nama proyek rumah (mis. `rumah-kami`).
**Yang terjadi:** memasang alat bila perlu, menyalin template kosong ke `projects/<nama>/`, membuat
`progress.md`.
**File:** `projects/<nama>/` (baru), `.active-project`.

## 1. Brief (wawancara) · 10–20 menit
**Ditanyakan** (6 kelompok pendek): jenis proyek dan denah yang Anda punya (foto/scan/PDF, sketsa tangan,
atau tidak ada); ukuran tanah dan sisi jalan; daerah/iklim (cukup tingkat kota); jumlah lantai; penghuni;
kamar tidur dan kamar mandi; jenis dapur; ruang tambahan; privasi, taman, cahaya alami; gaya; anggaran
dan daerah untuk estimasi biaya (opsional); fitur yang diinginkan.
**Tidak ditanyakan:** alamat, nama, atau detail keamanan.
**File:** `projects/<nama>/brief.md`, `progress.md`.
**Selesai bila:** Anda mengonfirmasi ringkasannya.

## 2. Denah & zoning — `/denah` · 20–60 menit
**Anda memberi:** foto, scan, atau PDF denah, atau foto sketsa tangan (taruh di
`projects/<nama>/private/plans/` atau seret ke chat) — atau tidak sama sekali, lalu wizard merancang dari
brief (mengusulkan dua alternatif).
**Ditanyakan:** konfirmasi skala dan bagian yang tidak terbaca (satu kelompok), lalu koreksi setelah Anda
melihat denah 2D ("kamar 2 lebarnya tambah 50 cm", "pintunya membuka ke arah lain").
**Yang terjadi:** ruang, dinding, pintu, jendela, dan tangga ditulis sebagai data, setiap pintu dilewati
otomatis dua arah, dan Anda mendapat gambar denah 2D plus tabel ruang dan luasnya.
**File:** data denah proyek, `progress.md`.
**Selesai bila:** Anda menyetujui denah.

## 3. Gaya — `/gaya` · 10–20 menit
**Anda memberi:** foto inspirasi (`projects/<nama>/private/inspo/` atau di chat).
**Ditanyakan:** foto mana untuk ruang mana, dan **apakah foto itu Anda ambil sendiri atau Anda punya izin
memakainya** — hanya foto seperti itu yang boleh dijadikan tekstur (mis. keramik yang Anda foto). Semua
foto boleh dipakai sebagai acuan gaya.
**Yang terjadi:** tabel per ruang (dinding, lantai, plafon, kayu, kain, logam, lampu, jenis furnitur)
untuk Anda setujui; lalu finishing diterapkan dan Anda melihat gambarnya.
**File:** `projects/<nama>/style.md`, data interior, tekstur opsional.

## 4. Interior — `/interior` · 15–40 menit
**Ditanyakan:** prioritas tiap ruang (ukuran kasur, jumlah kursi makan, TV, meja kerja, penyimpanan, anak,
hewan peliharaan), area yang harus tetap lega.
**Yang terjadi:** setiap ruang diisi furnitur berukuran nyata; pintu, jalur, dan jarak bebas dicek; Anda
melihat gambar per ruang dan mengoreksi lewat chat.
**File:** data interior.

## 5. Eksterior & tapak — `/eksterior` · 10–30 menit
**Ditanyakan:** gaya fasad, atap, pagar/gerbang, jalan masuk & parkir, taman, kolam, privasi.
**Yang terjadi:** bagian luar dibangun; jalur dari jalan ke setiap pintu luar dicek; Anda melihat gambar
dari jalan, dari taman, dan dari atas.
**File:** data eksterior/tapak.

## 6. Fitur — `/fitur` · 5–15 menit
Nyalakan atau matikan: pintu yang bisa dibuka, duduk, lift rumah · mobil yang bisa dikendarai · jelajah
bareng online dengan suara (perlu akun Supabase gratis milik Anda sendiri) · angka spesifikasi · estimasi
biaya · bake fotorealistik (perlu kartu grafis) · tapak & taman. Jalan-jalan, dollhouse, denah 2D, dan
minimap selalu aktif.
**File:** pengaturan fitur proyek.

## 7. Pencahayaan — `/pencahayaan` · ±5 menit (+ bake 10 menit–2 jam)
Gambar siang dan malam; lampu ditambah di ruang yang terlalu gelap. Bila komputer Anda punya kartu grafis
yang mumpuni dan Anda mau, "bake" menghitung cahaya diam yang realistis (lambat; diulang setelah ada
perubahan). Tanpa kartu grafis tahap ini dilewati — rumah tetap terlihat bagus.

## 8. Spec & biaya — `/spec-biaya` · 10–20 menit
**Ditanyakan:** daerah, tingkat kualitas, siapa yang membangun, apa saja yang dihitung.
**Yang terjadi:** luas dan volume diukur dari model; tabel harga disesuaikan dengan daerah Anda; Anda
mendapat total **dengan rentang** dan rinciannya. Ini estimasi untuk perencanaan, bukan penawaran harga.
**File:** tabel harga proyek, hasil hitung volume.

## 9. Pratinjau & cek — `/pratinjau`, `/cek` · 2–10 menit
Membuka rumah di browser Anda (juga di HP pada Wi-Fi yang sama). `/cek` menjalankan semua tes dan mengambil
screenshot; Anda mendapat laporan sederhana: apa yang lolos, apa yang bermasalah, dan apa yang belum dites.

## 10. Deploy — `/deploy` · 10–20 menit pertama kali
Mengonlinekan rumah di akun Vercel gratis **milik Anda sendiri**, bisa dengan PIN, supaya keluarga dan
teman bisa menjelajah dari HP. Anda sendiri yang membuat akun dan mengetik PIN di Vercel — wizard tidak
pernah melihatnya. Foto pribadi Anda tidak pernah diunggah.

---

## File yang dijaga wizard
| File | Isi |
|---|---|
| `projects/<nama>/progress.md` | posisi Anda, keputusan, pertanyaan terbuka, hasil tes terakhir |
| `projects/<nama>/brief.md` | jawaban wawancara |
| `projects/<nama>/style.md` | gaya per ruang yang disepakati + hak foto |
| `projects/<nama>/private/` | denah dan foto Anda (tidak diunggah, tidak masuk git) |
| `projects/<nama>/shots/` | screenshot |
