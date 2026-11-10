# Inordle v4: 6–20 letter dictionary submissions

Changes are applied to inordle-fixed. Nothing was pushed to GitHub or applied to live Supabase automatically.

## Supabase migration (required before publishing)

For an existing v3 deployment, extract supabase/update-v4.zip and run the SQL contents in numerical filename order:

1. 01-preserve-today.sql
2. 02-trails.sql
3. 03-submission-rules.sql

Do not rerun schema.sql or reimport the dictionary. If the previous migrations have not been applied, follow UPDATE.md and UPDATE-V3.md first. Existing answers and attempts are retained. Today's trail remains unchanged; future New York daily puzzles use the rebuilt catalog. New length and dictionary eligibility checks apply immediately to new submissions.

Verify:

```sql
select count(*) as trails, min(weight) as minimum_weight
from public.trail_catalog; -- 2393 trails, minimum weight at least 200
```

A submitted word and its normalized singular form must each be 6–20 English letters and exist in the dictionary. For example, garnets becomes garnet and is eligible; groves becomes grove and returns Too short. An eligible word that misses the trail uses an attempt. Wrong length, censored, non-letter, and non-dictionary entries do not consume attempts.

## Publish from PowerShell

Run commands individually; stop if a command fails. Preserve unrelated local changes shown by git status before pulling.

```powershell
Set-Location 'C:\Users\thecu\Downloads\codex\inordle-repository'
git status
git pull --ff-only origin main
robocopy 'C:\Users\thecu\Downloads\codex\inordle-fixed' . /E /XD node_modules dist .git __pycache__ .build-deps /XF 'preview*.png'
npm ci
npm test
git add .
git diff --cached --stat
git commit -m "Require 6–20 letter dictionary words and refine puzzle interface"
git push origin main
```

Robocopy exit codes 0–7 are nonfatal; 8 or higher indicates a failure. Keep the existing public Supabase config.js settings. Wait for GitHub Actions to finish and refresh with Ctrl+F5. The workflow includes the new ui.js and updated asset versions.

## Browser checks

- On first visit, How to Play opens. Close it and reload: it should remain dismissed.
- Submit a five-letter word: centered Too short popup, three attempts remain.
- Submit 21 letters: Too long, with no attempt used.
- Submit a 6–20 letter non-dictionary or censored word: Not a word, with no attempt used.
- Popups disappear after three seconds; repeated errors restart the timeout. The input shakes briefly (except with reduced motion enabled).
- Eligible dictionary words with the wrong trail use attempts and appear as letter rows.
- Matching word tiles use the exact trail tile color. Every answer tile has a drop shadow and hover press.
- After a solve or three failed attempts, the input, solve button, caption, and submission message disappear. The result list remains available.
- Header shows BY: COSMICCRYSTAL; puzzle card top right shows today's New York date.
