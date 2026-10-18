---
name: deploy-vercel
description: Guide a non-programmer step by step to put their house-3d-studio project online on their own free Vercel account on Windows, macOS or Linux - optional PIN protection (SITE_PIN, SITE_SECRET), optional Supabase multiplayer keys, verification and redeploys - without ever putting secrets in chat or git. Use in /deploy.
---

# deploy-vercel

Wait for the user at every account/login step. Never ask them to paste a PIN, password or token into the
chat; they type secrets into the Vercel website (or a hidden prompt) themselves.

## 0. Preflight (you run)
`npm run validate`, `npm run check`, `npm run test`, `npm run build` — all must pass.
`git status`: no `.env*`, no `projects/*/private/` photos staged. Confirm `.vercelignore` excludes
`projects/*/private/`, `node_modules`, `.env*` (if it doesn't, tell the maintainer/Phase-1A owner; do not
deploy private photos).

## 1. Vercel account (user)
"Open https://vercel.com/signup and sign up — the free Hobby plan is enough. Signing up with GitHub is
easiest." Wait for "done".

## 2. Log in from this computer
Run `npx vercel login` **in the user's own terminal** (it opens a browser / asks for email confirmation;
it is interactive, so ask the user to run it in a separate terminal window — the same command works in
PowerShell, macOS Terminal and Linux). Wait for "Success! / Berhasil".
Alternative without CLI: push the repo to the user's **private** GitHub repo and import it at
vercel.com/new (Framework: Vite; build `npm run build`; output `dist`).

## 3. Link + first deploy (preview)
Linking asks questions, so the **user** runs it in their own terminal: `npx vercel link` → scope = their
personal account, "link to existing project?" no, project name e.g. `my-house-3d` (lowercase, dashes),
directory `./`. This creates `.vercel/` (git-ignored). Then you run `npm run deploy` (validates, then a preview deploy;
non-interactive; the user gets a permission prompt first) and report the preview URL.

## 4. PIN (optional, recommended)
User, in the Vercel dashboard → Project → Settings → Environment Variables (Production + Preview):
- `SITE_PIN` = a PIN of 6+ digits (they type it; you never see it). Mark *Sensitive*.
- `SITE_SECRET` = a long random string. Generate one for them with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (works on all OSes) and
  tell them to paste it straight into Vercel, not into chat.
Then redeploy (step 6). The PIN gate protects every page and file; login lasts ~30 days per device;
changing `SITE_PIN` + redeploy logs everyone out.

## 5. Multiplayer (optional)
1. User creates a free Supabase account + project (https://supabase.com, region near them).
2. Project Settings → API: copy *Project URL* and the *anon public* key (the anon key is meant to be
   public; never use the `service_role` key).
3. In Vercel env vars (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Redeploy.
4. Locally (optional) put the same two in `.env.local` (git-ignored). Without keys, multiplayer works
   only between tabs of the same browser.
5. Voice over mobile data may need a TURN server (optional env, see `docs/ENGINE.md`).

## 6. Production deploy
`node scripts/deploy.mjs --prod` (validates first; identical in PowerShell and bash; `npm run deploy`
alone makes a preview). Claude Code shows the user a **permission prompt** before any deploy command
(`npm run deploy`, `node scripts/deploy.mjs`, `npx vercel …`): say so before you run it, and run
`node scripts/deploy.mjs --prod --dry-run` first if the user wants to see what will happen. Unknown
flags are refused, so a typo cannot turn a production deploy into a preview or the reverse.

## 7. Verify (you)
- Fetch the production URL (WebFetch, or
  `node -e "fetch('<url>').then(async r=>console.log(r.status,(await r.text()).slice(0,300)))"`):
  with a PIN it must return the PIN page (not the app, and not the data files);
  a wrong PIN must be refused. Without a PIN: the app loads.
- Ask the user to open it on their phone, enter the PIN, walk a bit, and report.
- Report only what you verified. Record in `progress.md`: URL, date, PIN on/off (never the PIN itself).

## Trouble
- `vercel: command not found` → use `npx vercel`.
- Build fails on Vercel but not locally → Node version: set Project → Settings → Node.js version to the LTS
  used locally.
- Some ISPs block or reset `*.vercel.app`; try mobile data, another DNS, or add a custom domain.
- Updating later: just `/deploy` again (preflight + `--prod`).
