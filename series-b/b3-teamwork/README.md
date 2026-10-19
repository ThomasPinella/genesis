# B3: Teamwork bonds

B2 showed that a day/night cycle keeps many kinds of small group alive, but nothing lasts, because
every bond is equally strong and heat cannot tell a well-built group from a loose one. B3 adds one term
to the energy so that strength comes from arrangement.

## The new ingredient
`U_team = -teamwork/2 * sum over balls of h_i²`, where `h_i` counts how bonded ball `i` is (each bond
between opposite spots counts `(1 - d²/RC²)²`, so 1 when snug). Because it grows as a square, every
extra bond on a ball deepens all of that ball's bonds by `teamwork`: a bond between two well-connected
balls is stronger than a lone one. It is still one energy; forces and torques are its slopes (checked
against a numerical slope). `teamwork` 0 is B2's physics. Everything else is B2 unchanged.

## Question
With teamwork bonds, do well-connected groups (rings, cages) outlast the days while loose chains break,
without the soup knitting into one net?

## What the sweep found
24 sparse worlds (density 0.05) of 1000 balls for 1200 time units (`tools/sweep.mjs`, results in
`sweep-results.json`): teamwork 0, 0.25 and 0.5; days at 0.2, 0.25, 0.3 and 0.35; nights at 0.06; a day
and night last 100; two seeds. Averages over the second half of each run unless noted.

- **The trade-off survives.** In every world where the days keep the biggest group under 10% of the
  balls, only 1-7% of groups of three or more get through a day intact, the same as with plain bonds
  (teamwork 0: 0-6%). In every world where 28-92% of groups get through a day, one group ends up holding
  59-100% of the balls.
- **Teamwork moves the boundary, not the trade-off.** With plain bonds days at 0.2 already stop the net;
  teamwork 0.25 needs 0.25, and teamwork 0.5 needs 0.35. Past the boundary the soup looks like B2:
  60-89 kinds of small group, nothing older than about two and a half days.
- **Rings hold better than chains.** At teamwork 0.5 and days of 0.2-0.25, three-ball rings survive a
  day 39-65% of the time against 18-31% for chains, and the oldest group in those soups is a ring that
  lasted 550-750 time units (five to seven days). Rings are rare (14-22 per run counted at dawn) and
  sit beside a net.
- **Cages don't.** Groups with loops and branches survive a day no more often than chains. They keep
  gaining balls (any change of membership counts as not surviving) and grow into the net.
- **The bond limit slips at strong teamwork.** At teamwork 0.5 up to 5.8% of spots hold two partners
  (about 1% at 0.25), and the books drift by up to 3.5% (about 1% at 0.25) because the deeper wells need
  a finer step than the one used.

## What it means
Any rule that rewards being well bonded rewards the net most, because the net is the most bonded thing
there is. Sturdier bonds therefore cannot by themselves give many separate, lasting structures. What is
missing is a way for a group to finish: to use up its open spots and stop sticking, as a water molecule
is complete and does not fuse with its neighbors. With four spots on a tetrahedron that is hard: two balls'
spots sit too far apart for the short reach to hold them by two spots at once, so nearly every group
keeps open spots and keeps growing.

## Running
Open `index.html` through any static server (it imports `sim.js`). `node tools/sweep.mjs > sweep-results.json`
reruns the sweep (about 1.5 hours on 4 cores; `PARTIAL=file` resumes).
