# B4: Caps

B2 and B3 showed that groups never finish: every ball has four spots, so nearly every group keeps
open spots and grows until it joins the net, and making bonds sturdier only makes the net sturdier.
B4 lets groups finish by adding balls with a single spot.

## The new ingredient
A share of the balls (`caps`) carry one spot instead of four, like hydrogen in real chemistry. The
spot sits at one corner of the same tetrahedron; the other corners are bare and feel nothing. The law
is unchanged (B2's plain bonds and day/night bath; `teamwork` is available but 0). Two ways to sign
the caps (`capSign`): `both`, half + and half −, or `plus`, every cap +, with the four-spot balls
carrying the matching extra − spots so the world still balances. A group is **complete** when every
spot in it is bonded: it has nothing left to stick with.

## Question
Can groups now finish, using up every spot, and do complete molecules outlast the days?

## What the sweep found
20 crowded worlds (density 0.3) of 1000 balls for 1200 time units (`tools/sweep.mjs`, results in
`sweep-results.json`): no caps, or caps at 25% or 50% of the balls with either sign rule; days at 0.12
or 0.15, nights at 0.06, a day and night last 100; two seeds. Averages over the second half of each run.

- **Caps stop the net.** Without caps, every night knits 99-100% of the balls into one net, and with
  days at 0.12 it never melts (89-91% at the end of the day). With half the balls as caps the biggest
  group stays under 21% by day and under 57% by night.
- **Groups can finish.** The commonest complete molecule is a + cap holding a − cap (80-104 of them at
  once when caps come in both signs). Bigger complete molecules appear too: a four-spot ball wearing
  four caps (5 balls) and two four-spot balls joined and wearing six caps (8 balls), which are the
  shapes of methane and ethane. They are few: about 1-10 present at a time.
- **Complete molecules last.** With days at 0.12, 89-97% of complete molecules of three or more balls
  get through a day, against 26-29% of open groups. With days at 0.15 it is 47-57% against 5-8%. The
  oldest group in four of the eight caps-50% runs is a five-ball molecule, and the longest-lived lasted
  1050 time units, ten and a half days, nearly the whole run. Without caps nothing of three or more
  balls survives a day.
- **Caps of one sign make bigger molecules.** With every cap +, caps can't waste themselves on each
  other, and the eight-ball molecule appears (8-21 counted over the late looks); with mixed caps most
  caps end up as cap pairs.
- **Checks.** At most 0.1% of spots ever held two partners; the books drift by under 0.8%.

## What it means
This is the first thing in series B that persists through disturbance: being complete is what lets a
group survive the days, and the soup selects for it. But completeness has a cost. A complete molecule
has no open spots, so it no longer interacts with anything except by bumping. It is a dead end for
building the next level up. The next level needs groups that are complete enough to last but still
show something to the outside, the way a water molecule is complete yet still has a + side and a −
side. The renormalization idea from the start of the series lives exactly there: what a finished group
leaves over is what the next level is built from.

## Running
Open `index.html` through any static server (it imports `sim.js`). `node tools/sweep.mjs > sweep-results.json`
reruns the sweep (about 1.5 hours on 4 cores; `PARTIAL=file` resumes).
