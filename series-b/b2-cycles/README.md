# B2: Day and night

B1 showed that polar spotted balls cool into one tangled net, and that a sealed box stays too hot to
build anything. B2 adds the one ingredient B1 asked for: energy flowing through.

## The new ingredient
Every ball touches a bath that is warm by day and cool by night (a square wave; the world starts at
night). Each ball, on its own, is nudged toward the bath temperature: its motion is scaled up when it is
slower and down when it is faster (`coupling` 1 per unit time). Nothing is random and nothing reaches
beyond the ball itself. Everything else is B1 unchanged: four + or − spots per ball, one-partner spots,
no overlap, continuous 3D, deterministic.

Books: energy now + net heat taken out by the bath = energy at the start.

## Question
Does a day/night cycle keep many kinds of small shape alive instead of one net, and do any of them
survive the days?

## What the sweep found
22 worlds of 1000 balls for 1200 time units (`tools/sweep.mjs`, results in `sweep-results.json`).
Sparse soups (density 0.05) with nights at 0.06 and days at 0.15 or 0.2, with a day and night lasting
50, 100 or 200; steady baths at 0.06, 0.12 and 0.2 as controls; plus a crowded soup and a
two-plus-two-minus ("water") soup on the 0.2 cycle. Two seeds each. Numbers below are averages over the
second half of each run.

- **Hot days stop the net.** With days at 0.2 the biggest group never passes 7% of the balls. The
  five-kind soup holds 77-87 kinds of small group at once, 18-26 of them seen more than once (water
  balls: 24-26 kinds). Without the cycle, a steady bath of 0.2 holds only 35-36 kinds, and steady baths
  of 0.06 or 0.12 end in a net (96-100% in one group). So the cycle, not just warmth, keeps the variety.
- **Gentle days lose to the net.** With days at 0.15 every sparse soup ends in a net (88-98% in one
  group) within 1200 time units, at every day length.
- **Crowded soups just flip.** At density 0.3 each night builds a net of 98% of the balls and each day
  melts it; nothing of size 3 or more survives from one look to the next.
- **Nothing lasts.** On the 0.2 cycle only 1-17% of groups of three or more survive a day intact
  (5-42% survive a night). No group outlives about two days (oldest: 150-225 time units; a day
  and night last 50 to 200), and the survivors are almost all three-ball chains.
- **No sign of selection.** Groups that survive a day have as many open spots as those that don't
  (about 0.65 vs 0.60 of their spots), so the day is not sparing better-built groups; it breaks bonds
  without regard to what they belong to.
- **Checks.** At most 1% of spots ever held two partners (in the nets of the 0.15 runs; under 0.05% on
  the 0.2 cycle). The books drift by up to 0.6% (sparse) and 1% (crowded) over 1200 time units, the
  step error building up.

## What it means
Flow does what B1 asked: the soup no longer freezes into one net, and it keeps far more variety than a
steady bath. But there is a hard trade-off. A day hot enough to melt the net also melts everything else,
and a day gentle enough to spare small groups lets the net win. The reason is that every bond is one
spot pair of the same strength, so heat cannot tell a well-built group from a loose one. Structures that
persist through disturbance, the first thing life needs, need some bonds to hold better than others
because of how they are arranged. This is the risk the series proposal named before B1.

## Running
Open `index.html` through any static server (it imports `sim.js`). `node tools/sweep.mjs > sweep-results.json`
reruns the sweep (about an hour on 4 cores; `PARTIAL=file` resumes).
