# Inordle

A daily, single-word puzzle built for a free GitHub Pages project site. No build or paid hosting is required for the frontend.

## Play locally

Requires Python 3 and Node.js 24 for tests (the website itself has no JavaScript dependencies).

```powershell
npm ci
npm test
python -m http.server 8000
```

Open http://localhost:8000. With empty config.js values the site clearly labels itself **Local demo**. It saves attempts in this browser and shows only your own answer. The header count is explicitly labeled as local; live mode shows the total accepted daily responses before or after finishing. Use a separate browser profile to try another local game. Live and demo saves are separate.

## Enable real community results

GitHub Pages serves static files; it cannot securely store submissions. The included Supabase Postgres backend supplies anonymous browser sessions, authoritative validation, daily locks, and shared rankings.

1. Create a Supabase project. Review the provider's current plan limits; a no-cost tier is available, subject to its quotas.
2. In Authentication settings enable **Anonymous Sign-Ins**. Configure site URL to your eventual GitHub Pages URL. Consider provider bot protection and monitor authentication quotas before promoting the game publicly. Enabling a CAPTCHA also requires adding its widget/token to the frontend signup flow; this version does not include that widget.
3. Run `supabase/schema.sql` in the project's SQL editor **once**, then run `supabase/dictionary.sql`, every SQL file in `supabase/word-forms/`, and finally `supabase/trails.sql`. Existing deployments should follow UPDATE.md instead of rerunning schema.sql. If the SQL editor cannot handle the dictionary file's size, execute it through the project's PostgreSQL connection using psql, or paste complete insert statements in smaller batches. Finish importing before launching.
4. In `config.js`, set `url` to the project's HTTPS URL and `key` to its **publishable key or legacy anon key**. Both are public browser settings. Never use the service-role or secret key.
5. Test in two browser profiles. Neither should see rankings before finishing. After both submit the same accepted word, its count should be 2. Refreshing must retain each profile's locked state.

All tables have RLS enabled with no client table policies. Clients can execute only the `play` RPC; it derives the player from the verified JWT and the date from server time. It never trusts a client-supplied success flag, letter trail, count, or player ID. A row lock serializes submissions; UUID request IDs avoid charging a retry twice. The server rejects submissions for a previous day's puzzle without spending an attempt.

## Publish to a new GitHub Pages repository

1. Create a new **public** GitHub repository. Upload the **contents of this directory**, including `.github/workflows/pages.yml`, to its root on the `main` branch. Exclude `node_modules` and the local preview image.
2. In repository Settings → Pages, select **GitHub Actions** as the source.
3. Push to `main` or run the Deploy GitHub Pages workflow. It installs test dependencies, runs tests, and deploys only the public site files. SQL, raw word sources, and tests are excluded from the deployment artifact.
4. Your URL will be `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. All asset references are relative and work under a project subpath.

No repository was created or published as part of the local build. GitHub and Supabase account setup remain required.

## Rules and interpretation

- One daily game, up to three submitted attempts. Only in-range, uncensored dictionary words rejected by the letter-order check spend an attempt. Entries outside 2–50 English letters, non-letter input, censored words, words outside the dictionary, and empty input do not. Connection failures do not intentionally spend a second attempt; retry the same word if the server response was lost.
- A correct word ends the game immediately. Three failures also end the game. Rankings appear **after the game ends**, so a failed first attempt does not expose answers for the next attempt.
- Singular and plural dictionary forms are validated and counted separately.
- A word is valid when it is 2–50 ASCII letters, in the included English dictionary, absent from the moderation exclusions, and contains each trail letter as a subsequence. Case is ignored. Spaces, apostrophes, and hyphens are not accepted.
- Trails contain 2–5 letters and are drawn from a prevalidated catalog of 2,393 trails. Every trail has at least **eight distinct solutions** in the filtered dictionary. Approximately one day in twelve includes exactly one vowel; the remaining days use only consonants. Vowel trails contain 3–5 letters so consonants remain the majority. The catalog requires eight solutions with wordfreq Zipf frequency of at least 2.5, and favors trails whose eight most common solutions have higher mean frequency.
- `build-trails.py` generates `trails.js` and `supabase/trails.sql` together from safe seed words and the actual filtered dictionary. It discards candidates with fewer than eight frequency-attested solutions. The browser and SQL use identical deterministic daily selection, so no scheduled job is needed. Trails may repeat. `build-data.py` automatically rebuilds the trail catalog after dictionary changes.
- The date is `America/New_York`: midnight EST in winter and midnight EDT in summer, rather than a fixed UTC−5 offset. The page notices rollover while open.
- Rankings contain **all** distinct accepted words for today's puzzle, sorted by frequency descending, then alphabetically. No unsuccessful guesses or player identifiers are exposed. The aggregate answer count in the header is visible before finishing; individual answers remain hidden until the game ends. Daily checks for updated counts and rankings every 10 seconds while visible. Each row’s bar uses its count divided by all solved responses, displays a percentage to two decimal places, and highlights the player’s chosen word.

## Limits worth understanding

**One system per day:** ordinary websites cannot identify a physical computer reliably without intrusive fingerprinting or device enrollment. This implementation enforces one game per anonymous browser identity on the server. Reloads and parallel tabs retain the limit; clearing storage, private browsing, or using another browser creates a new identity. Supabase documents this behavior. Requiring a permanent sign-in would strengthen the rule across devices; it still cannot guarantee one account per computer.

**Dictionary and moderation:** the bundled Sindre Sorhus English word list contains rare words and inflections, not just everyday vocabulary. The LDNOOBW English list plus common suffixes excludes listed profanity and derogatory terms. Moderation lists are imperfect: review the accepted lexicon before public launch, maintain `data/blocked.txt`, and add terms as needed. To rebuild, run `python build-data.py`. On an already deployed backend, replace the dictionary transactionally (delete existing entries then import the regenerated dictionary.sql) so newly blocked entries are removed as well. Historical answers require a separate editorial removal if newly disallowed.

**Privacy:** the local demo stores daily guesses in localStorage. Live mode stores anonymous session credentials locally and stores a Supabase authentication ID, date, attempts, retry IDs, and accepted answer in the backend. Accepted words and aggregate counts are visible to players who finished. No email or name is requested. Supabase/GitHub may maintain their own security logs. Comfortaa and its SIL Open Font License are bundled locally; no Google Fonts request is required. There is no advertising or analytics code. The operator should establish a retention policy for old games/authentication records.

## Verification

`npm test` tests subsequence order and repeated letters, dictionary/moderation, winter/summer/DST boundaries, every catalog trail’s minimum of eight canonical solutions, three years of daily selections and JavaScript/PostgreSQL parity, and the actual PostgreSQL schema through PGlite. Server tests check authentication, attempt ceilings, retry deduplication, stale-day rejection, answer locks, hidden rankings, unique-word counts, ranking order, and denied direct table access. PGlite tests do not replace a smoke test against your deployed Supabase authentication and REST services.

## Appearance

Inordle uses Comfortaa throughout, magenta as its main accent, and purple as its secondary accent. The light/dark toggle sits to the right of Help, follows the system preference on first visit, and remembers the selected theme. The game has no result-copy button or About/privacy footer link.

## Sources and licenses

- Dictionary: https://github.com/sindresorhus/word-list — MIT; see data/DICTIONARY-LICENSE.
- Moderation source: https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words — CC BY 4.0; see data/BLOCKLIST-LICENSE. The derived dictionary removes exact listed words and generated suffix variants.
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Anonymous identities: https://supabase.com/docs/guides/auth/auth-anonymous

## Refreshing an existing local preview

Serve this **inordle** directory, not the previous consonest directory. For example, run `python -m http.server 8000` from this directory. The current HTML versions its stylesheet and scripts to avoid reusing earlier cached files. Theme controls run independently of puzzle/backend initialization. Upload the complete assets directory when deploying; it includes the bundled Comfortaa font and its license.

## Rebuilding normalization and weighted trails

No Python build packages are required to play or to run npm test; generated outputs are committed. To regenerate them after dictionary edits, install the build dependency once with `python -m pip install --target .build-deps wordfreq==3.1.1`, run `npm ci`, and run `python build-data.py`. To regenerate only plural mappings and trails, run `node build-normalization.mjs` then `python build-trails.py`. Update the expected word-forms count in the normalization migration if the dictionary changes. Build-only .build-deps and node_modules are ignored and should not be uploaded.

Weights are bounded integer values calculated as round(10 ** (meanZipf - 2)) over the top eight canonical solutions. Selection is proportional to these weights within the day's length and vowel category. The existing 2–5-letter schedule and one-vowel day roughly once every twelve days remain. See data/WORDFREQ-NOTICE.md and data/WORDFREQ-UPSTREAM-NOTICE.md for frequency-data attribution and licensing; the derived frequency metadata and weights are CC BY-SA 4.0. Plural mappings use pluralize 8.0.0 (MIT; see data/PLURALIZE-LICENSE).

## Animated word board (v3)

See UPDATE-V3.md for the three-file migration for existing v2 deployments. Today’s live trail is preserved and the weight-200 cutoff applies to future daily puzzles. Every newly selected trail has weight >= 200 and still has eight distinct canonical solutions. Fresh installations must also import supabase/blocked-words.sql before opening the site.

The original trail remains at the top. Submitted words appear oldest first below it, above the answer field. The old under-input answer chips and trail separator dots are removed. Incorrect rows expand the puzzle before fading in; a longest ordered alignment colors matched trail letters in the accent color, other occurrences of trail letters in the sub-accent, and inserted letters light gray. A correct row animates the aligned trail letters from their original tile positions into the final centered word; inserted gray letters use sampled easeInCirc keyframes. A correct word briefly brightens after assembly. Incorrect attempts get a left-to-right sub-accent strike with a black outline and their tiles stay in place on hover. Long words shrink to fit a single centered row on narrow screens. Reduced-motion preferences show the final word without movement or a flash. Refreshing restores the board without replaying effects. The GReaT example is hidden whenever daily results are shown.

## v4 submission rules and interface

See UPDATE-V4.md for the existing-deployment migration and publishing steps. Both raw and singularized words must contain 6–20 English letters and exist in the filtered dictionary. Too short, Too long, and Not a word are uncharged submission errors. The popup is centered, fades during its three-second lifetime, and shakes the input briefly unless reduced motion is requested. Only eligible dictionary words that fail the trail consume an attempt.

Matching word letters share --trail-color with the original trail rather than --accent. All submitted letter boxes have a shadow and the same five-pixel hover press as the original tiles. BY: COSMICCRYSTAL appears in the header, and the New York puzzle date appears at the top right of the puzzle card. The input form, caption, and submission message are hidden when a game ends. How to Play opens automatically until dismissed once in that browser profile; no account-level or cross-device tracking is introduced. The example now uses GRaTeful, which meets the six-letter minimum.

The catalog was rebuilt against eligible canonical 6–20-letter solutions: 2,393 trails, each with at least eight frequency-attested solutions and weight >= 200. Existing game records and today's live trail are preserved by the migration; future puzzles use the rebuilt catalog.


## Daily and Casual update

Apply [supabase/update-v5.sql](supabase/update-v5.sql) in the Supabase SQL Editor for an existing v4 deployment, then publish the updated frontend from this folder. This migration accepts eligible words of 2–50 letters and groups Daily results by the spelling stored for each answer. Earlier answers keep their stored spelling, including answers that an older version converted to singular form.

Daily checks for changes every 10 seconds while open and visible, and refreshes when the tab becomes visible again. Casual runs in the browser and selects uniformly from the playable trail catalog, excluding the current trail on a redraw. Press Space or click the refresh icon to clear the attempts and draw a new Casual trail. The word input stays focused after submitting. Switching modes keeps the current Casual trail and attempts until the page is reloaded.

The existing dictionary's longest entry is 28 letters. Validation supports entries up to 50 letters if the dictionary is expanded. New installations can use the updated schema and existing dictionary, moderation list, and trail catalog.

Blitz runs locally and starts with a two-minute countdown. Each accepted solution adds five seconds and scores 50 points plus 10 per extra letter. A solution earns 50 more points if its trail can be matched with a gap between every pair of trail letters. The next trail appears after the solve animation. The timer continues while you view another mode. The final summary shows elapsed time, points, and the number of solved trails. Casual rejects repeated guesses on the same trail.
