# Security policy

*(Bahasa Indonesia di bawah.)*

## Reporting a vulnerability
Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: open the **Security** tab of this repository and click
**Report a vulnerability**. Describe what you found, how to reproduce it (with `projects/sample-house`,
never with your own house), and what an attacker could do with it. You will get an answer within
about a week.

Things we especially want to hear about:
- the optional PIN gate (`middleware.js`) letting someone in without the PIN, or leaking the PIN/secret;
- private files (`projects/<house>/private/`, `.env*`) ending up in git, in a build (`dist/`) or in a
  deployment;
- the wizard settings (`.claude/settings.json`) letting Claude Code publish, delete or read secrets
  without asking;
- the multiplayer session exposing more than the shared walk-through.

## Supported versions
Only the latest release on the default branch gets fixes. Copies made from the template do not update
themselves; see the README FAQ "How do I get template updates?".

## What is not a vulnerability
- Anyone with your site link **and** PIN can see your house: that is how sharing works. Change the PIN
  (`SITE_PIN` in Vercel) if it leaked.
- A public copy of the template that contains someone's real house: ask the owner to make it private.

## Melaporkan celah keamanan (Indonesia)
Jangan membuka issue publik. Buka tab **Security** di repositori ini → **Report a vulnerability**,
jelaskan temuan dan cara mereproduksinya dengan `projects/sample-house` (jangan dengan rumah Anda).
Yang paling penting: gerbang PIN bisa dilewati, file pribadi (`private/`, `.env*`) ikut ter-commit atau
ter-deploy, atau pengaturan wizard membiarkan Claude Code mempublikasikan/menghapus/membaca rahasia
tanpa bertanya. Kami akan menjawab dalam sekitar satu minggu.
