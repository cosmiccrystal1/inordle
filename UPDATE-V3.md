# Inordle v3: attempt rules and animated words

Changes are saved in inordle-fixed only. No GitHub push or live Supabase change has been performed automatically.

## Supabase update (required)

If the previous v2 update is installed, extract supabase/update-v3.zip and run the SQL contents in this order:

1. 01-prepare.sql
2. 02-trails.sql
3. 03-attempt-validation.sql

The three files are small enough for SQL Editor. They preserve existing player rows, answers, and attempts. The first file snapshots today's trail so people arriving later see the same puzzle. The updated weight cutoff starts at the next New York midnight. Do not rerun schema.sql or reimport the dictionary. If v2 has not been installed yet, follow UPDATE.md and its SQL bundle before applying these three files.

The server and browser both reject censored words and submissions outside 2–32 English letters without consuming attempts. Non-letter input is also uncharged. Dictionary failures and incorrect letter order continue to use an attempt. Existing attempts from before the update are retained, not retroactively refunded.

Verify in SQL Editor:

```sql
select count(*) from public.trail_catalog; -- 2463
select min(weight) from public.trail_catalog; -- at least 200
select count(*) from public.blocked_words; -- at least 1915
```

## Publish the changed folder

Run the commands individually and stop on errors. Preserve unrelated changes shown by git status before pulling.

```powershell
Set-Location 'C:\Users\thecu\Downloads\codex\inordle-repository'
git status
git pull --ff-only origin main
robocopy 'C:\Users\thecu\Downloads\codex\inordle-fixed' . /E /XD node_modules dist .git __pycache__ .build-deps /XF 'preview*.png'
npm ci
npm test
git add .
git diff --cached --stat
git commit -m "Animate submitted words and refine attempt validation"
git push origin main
```

Robocopy exit codes 0–7 are nonfatal; 8+ indicates a failure. Keep the current public config.js settings. Wait for GitHub Actions to succeed, then refresh the website with Ctrl+F5. The workflow includes board.js and data/blocked-words.json. CSS and JavaScript asset versions were increased.
