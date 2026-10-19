# Experiment 5: Shaking light

**Question:** if light warms what absorbs it, so that every place warms by day and cools by night,
can a template's partners sort themselves out and a copy let go?

This is the world of [experiment 4](../04-face-chemistry/), changed in one place. Until now, light
that a particle absorbed went into its store and nowhere else, so the world cooled until nothing
moved. Experiment 4's template probe found that the cold freezes wrong partners in, and that the
optional noise, warm enough to free them, also breaks the template. The cheap checks there found
that bonds make neighbors complementary rather than alike, which rules out recruiting but fits
templating (as with DNA, where the copy of a copy is the original). What templating lacked was a
way to let go.

- **Light shakes bonds.** A share of the light a bonded particle absorbs (`shake`, default 0.25)
  goes into its bonds instead of its store. Each bond gets an equal and opposite push along the
  bond, apart, carrying exactly that energy. A bond the push carries past its depth breaks; a
  stronger one rings and holds.
- **Nothing else changes.** The pushes add no momentum and no turning (sideways momentum stays at
  zero to rounding), total energy still never rises by more than the light absorbed, and nothing is
  random. With `shake` at 0 the world is experiment 4 bit for bit, which is the ablation.
- Since the sun sweeps across the world, each place gets its days and nights.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

The new slider is under Sun and energy. **Drop in a template chain** works as in experiment 4.

## Findings

From the template probe on the eight laws whose lenses allow a two-letter code (laws 5, 62, 74,
76, 116, 155, 193 and 294; law 180 has none under the probe's test), 2 starts each, at shake 0,
0.25, 0.5 and 1, with 120 building blocks freed beside the chain and watched for 4,000 ticks (four
days). Results are in `template-results.json`.

- **No copy forms.** At every shake level, partners beside the chain link into at most 4 to 7 in a
  row, as in experiment 4.
- **Partners don't sort themselves out.** The share of partners that are the matching letter stays
  at chance, 41 to 53% at every level.
- **Where the template absorbs light, the light breaks it.** In laws 74, 116, 193 and 294 the
  chain's own members absorb light, and the share of its spine still intact falls from 19% without
  shaking to 9%, 7% and 0% as the shake rises. Where the template barely absorbs (laws 5, 62, 76 and
  155), the light lands on its neighbors and the chain holds about as well as without (49 to 63%
  intact).
- **Why, as far as this shows:** the push goes into every bond of a particle that absorbs, the
  spine as much as the sides, so it frees right and wrong partners alike and weakens the template
  too. The heat it adds is selective only through bond strength, and in these laws a right
  partner's bond is barely stronger than a wrong one's (the code margins are small), so warming
  gives selection almost nothing to work with. Copying would need a much larger gap between the
  right side bond and the wrong one, and a spine much stronger than both.

From a sweep of 48 worlds: 12 laws × 2 starts, each with shake 0.25 and with shake 0
(experiment 4), 4,000 ticks, 1,500 particles (`sweep-results.json`, and the World map panel).

- **The world runs warmer and looser.** In every law fewer particles stay bonded: 39 to 91% with
  shaking, against 50 to 100% without. The coldest laws warm the most (in laws 4, 9 and 11 the
  energy of motion is two to six times higher).
- **But not by day and night.** Lit and dark places run about equally warm with shaking. Drag takes
  about half a day to soak up a push, so the warmth spreads and lingers instead of following the
  sun. Where lit places were already warmer without shaking (laws 1, 3, 6 and 12, from moving and
  eating by day), shaking doesn't widen the gap.
- **Repeated arrangements thin out, and nothing new is copied.** Groups sharing an exact
  arrangement drop in most laws (law 8 from 18 to 34 particles' worth to 2 to 6; law 10 from 38 to
  46 to 8 to 14). Identical splits stay as rare as before (0 to 3 per world). Law 11's long chains
  shorten from 8 to 10 particles to about 5.
- **Little of the light shakes anything.** Only 2 to 9% of the light absorbed goes into bonds,
  since much of it lands on particles with no bonds, which store it as before.
- **The books balance.** In all 48 worlds, total energy never rose by more than the light that
  came in over any 20-tick check.

## Searching laws for a strong code

Every copying test so far ran into the same thing: in the laws tried, a right partner bonds only a
little more strongly than a wrong one. `tools/search.mjs` changes no rule; it scans 100,000 laws for
the biggest code gap: a spine much stronger than the right side bond, and the right side bond much
stronger than the same letter at that face (`search-results-faces1.json`, `-faces2.json`).

- **Big gaps exist, but rarely.** About 1.7% of laws have any gap at all (1.2% at faces 2). The best gap at faces 1
  (law 64401: spine 2.1, right 1.3, wrong 0.16) is four times law 5's, and eight times with the
  faces dial at 2 (law 94116).
- **They don't copy either.** The template probe (`STRICT=1`) on the four best laws at faces 1 and
  the three best at faces 2, with and without shaking light (`search-template-results.json`):
  templates fall apart (0 to 46% intact) and partners are the matching letter 20 to 55% of the
  time, at or below chance. No copy grows past 6.
- **Why: every open face is a site.** A partner can stick to any of the four faces a chain member
  leaves open, and the soup holds every element of the law. Counting all of those (the all-sites
  gap), the right partner at the side face beats every other attachment in none of the 200,000
  laws at faces 1 and 2; the best comes within 0.07. In a quick check of 2,000 laws with longer
  genomes (8 numbers instead of 4) it is worse, because a law then has more elements and so more wrong partners. In a random law,
  any face that is sticky at all is sticky to many partners, so one right partner never stands out.

The search: `FACES=1 LAWS=100000 node tools/search.mjs > search-results-faces1.json`; the probe on its best laws: `STRICT=1 FEED=120 WATCH=4000 SHAKES=0,0.25 LAWLIST=64401,68320,44510,12291 node tools/template.mjs`.

Rerun the probe with `CODE=1 FEED=120 WATCH=4000 SHAKES=0,0.25,0.5,1 LAWLIST=5,62,74,76,116,155,180,193,294 node tools/template.mjs > template-results.json`
and the sweep with `SHAKES=0,0.25 WORLDS=1,2 node tools/sweep.mjs > sweep-results.json`. Both take
`PARTIAL=file.jsonl` to save each world as it finishes.
