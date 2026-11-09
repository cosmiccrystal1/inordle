# Update the existing Inordle deployment

The inordle-fixed folder now includes plural normalization, at least eight distinct frequency-attested canonical solutions per generated trail, frequency-weighted daily sampling, highlighted selected results, percentages and proportional bars, and press-down trail tiles. GitHub has not been changed automatically.

## 1. Apply the Supabase update before publishing the frontend

Use supabase/update-v2.zip. Extract it and run its SQL files in numerical filename order in Supabase SQL Editor:

1. 01-prepare.sql
2. 02-forms-01.sql through 02-forms-13.sql (all thirteen files)
3. 03-trails.sql
4. 04-enable-normalization.sql

Each file is under 200 KB to fit the editor's upload limit. These files are safe to retry. Do not rerun schema.sql or reimport the dictionary for this upgrade. The prepare step snapshots today's live trail; the new catalog applies at the next New York midnight. Current accepted answers and attempts are retained. Plural normalization takes effect when the final file is applied; historical result rows aggregate under canonical words without changing stored submissions. Rerunning the prepare step preserves the trail that is current on that day.

Verify in SQL Editor:

```sql
select count(*) as word_forms from public.word_forms; -- 90773
select count(*) as eligible_trails from public.trail_catalog; -- 5148
select public.normalize_word('gardens'); -- garden
select public.trail((now() at time zone 'America/New_York')::date);
```

Keep all RLS and permissions installed by the scripts. No new secret or API key is needed.

## 2. Copy and publish from PowerShell

Run the following commands one at a time. Stop if git reports an error. The pull must complete before copying the updated source. Robocopy exit codes 0–7 are not failures; 8 or higher is a failure.

```powershell
Set-Location 'C:\Users\thecu\Downloads\codex\inordle-repository'
git status
git pull --ff-only origin main
robocopy 'C:\Users\thecu\Downloads\codex\inordle-fixed' . /E /XD node_modules dist .git __pycache__ .build-deps /XF 'preview*.png'
npm ci
npm test
git add .
git diff --cached --stat
git commit -m "Normalize plurals and improve daily trails and rankings"
git push origin main
```

If git status shows unrelated local work before pulling, commit or otherwise preserve that work first. Review the staged file list before committing. Your existing config.js values should remain your current public Supabase URL and anon key; no secret keys belong in the repository. The workflow now deploys normalization.js and frequency/license notices as well as the existing assets.

Wait for GitHub Actions to finish, then reload https://inordle.com/ with Ctrl+F5. Asset versions were updated to prevent stale scripts and styles.

## Rules to be aware of

Plural submissions are singularized before checking the trail. gardens can solve GRD but not GRDS, since garden has no S. Singular and plural versions share one ranking entry. English words can be grammatically ambiguous; the rules are dictionary-backed and use pluralize 8.0.0 rather than sentence context.

The percentage denominator is the total count of accepted daily responses, including all words. Five players out of six produces an 83.33% bar and the label '5 players - (83.33%)'. Independently rounded percentages can sum to 99.99% or 100.01%.
