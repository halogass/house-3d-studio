# Contributing

Thanks for helping! *(Bahasa Indonesia di bawah.)*

- **Bugs and ideas:** open a GitHub issue. Describe what you did, what you expected and what happened,
  your OS, browser and device. **Never attach your own house plan, photos, address or site link/PIN** —
  reproduce with `projects/sample-house` instead.
- **Pull requests:** small and focused. Before opening one, run (same in PowerShell and bash):
  ```
  npm install
  npm run validate
  npm run check
  npm run check-interior
  npm test
  npm run build
  ```
  and say in the PR what you tested and what you did not (e.g. "not tested on a phone").
- **Rules:** Node-only tooling (must work on Windows, macOS and Linux — no shell-specific scripts);
  no new heavy dependencies without discussion; assets must be CC0 or your own work (add credits);
  no secrets or personal data in commits; keep the engine data-driven (no house-specific code in
  `engine/`); user-facing text in both English and Indonesian.
- **Wizard changes** (`CLAUDE.md`, `.claude/`): keep commands bilingual, keep the rule "ask in batches
  with options, never invent dimensions silently", and update `docs/WIZARD.md` + `docs/WIZARD.id.md`.
- **CI** runs the same commands on Windows, macOS and Linux (Node 20, 22, 24) plus a headless browser
  smoke test (`node .github/scripts/smoke.mjs` after `npm run build`). Add user-visible changes to
  `CHANGELOG.md` under "Unreleased".
- **Security problems:** report privately, see [SECURITY.md](SECURITY.md).
- By contributing you agree your work is released under the MIT licence.

## Kontribusi (Indonesia)
- **Bug dan ide:** buka issue di GitHub. Jelaskan langkah, harapan, hasil, OS, browser, dan perangkat.
  **Jangan lampirkan denah, foto, alamat, atau link/PIN rumah Anda** — gunakan `projects/sample-house`.
- **Pull request:** kecil dan terfokus. Jalankan dulu perintah di atas dan tuliskan apa yang sudah dan
  belum dites.
- **Aturan:** alat hanya Node (harus jalan di Windows, macOS, Linux); tanpa dependensi berat baru tanpa
  diskusi; aset harus CC0 atau karya sendiri; tanpa rahasia atau data pribadi; engine tetap berbasis
  data; teks untuk pengguna dalam bahasa Inggris dan Indonesia.
- Dengan berkontribusi, Anda setuju karya Anda dirilis dengan lisensi MIT.
