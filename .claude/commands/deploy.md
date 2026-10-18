---
description: "Online-kan rumah ke Vercel (PIN opsional) / Put the house online on Vercel (optional PIN)"
argument-hint: ""
---

# /deploy — deploy (stage 10)

Use the `deploy-vercel` skill, step by step, waiting for the user at each account/login step.
Before anything: `npm run validate`, `npm run check`, `npm run test`, `npm run build` must pass, and
`git status` must show no secrets or private photos staged. `node scripts/deploy.mjs --dry-run` shows
what would be deployed without uploading anything.
Claude Code asks the user for permission before `npm run deploy` / `node scripts/deploy.mjs` runs
(deploying publishes the house). Tell the user beforehand that a permission prompt will appear and
that they should approve it only if they want the house online now. Ask one batch first:
1. PIN protection? (recommended: yes, 6+ digits, the user types it into Vercel themselves — never into chat)
2. Multiplayer online? (needs Supabase keys)
3. Project name / URL wish.
Report the final production URL only after the deploy output shows it, and after you checked the URL
responds (PIN page if a PIN is set). Record in `progress.md` (URL ok; never the PIN).
