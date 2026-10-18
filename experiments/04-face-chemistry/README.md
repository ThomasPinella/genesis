# Experiment 4: Face chemistry

**Question:** if each face of a particle has its own chemistry, can a chain act as a mold for a
copy of itself?

This is the world of [experiment 3](../03-geometry/), changed in one place. In experiment 3 a face
only decided *where* a particle was sticky; *who* it stuck to came from one genome match per pair
of elements, the same through every face. The [template probe](../03-geometry/#the-template-probe)
showed that this rules out copying: a bond along a chain's spine and a bond at its side were the
same bond.

- **Each face has its own lens.** A particle shows its genome to a neighbor through the faces
  turned that way, each face through its own lens: the genome as it is, plus a twist that belongs
  to that face. The twists are matrices in the law, so nobody lists what a face likes. One face
  can like the particle's own kind while another likes only a partner.
- **One dial for how different faces are.** `faces` scales the twists. At 0 every face is alike;
  at 1 (the default) faces are distinct sites. `geometry` at 0 still gives back experiment 2
  exactly, which is the ablation.
- **How open a face is** (how strongly its lens reads the genome) sets how much a particle attends
  through it and how much light it sees through its top. The page draws a particle's most open
  faces as short spikes.
- **Still one energy.** Forces, torques and genome changes are the slopes of the same energy and
  match finite differences; a pair's forces and torques add to no net push or twist; the books
  balance in every world. Deterministic, as before.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

**Drop in a template chain** (under Shape) builds the chain the law favors, frees 120 building
blocks around it and zooms in; the shapes panel then counts partners beside it and how many are
the matching letter. Verify replay repeats the drop.

## Findings so far

From a sweep of 48 worlds (12 laws × 4 starts, 4,000 ticks, 1,500 particles) with face
chemistry, against the same laws and starts under experiment 3's rule (`sweep-results.json`, and
the World map panel), plus template probes (`template-results.json`).

- **Every law bonds now.** Under experiment 3's rule, six laws stayed a gas with at most 16% of
  particles bonded. With face chemistry every law bonds 53 to 100%, and still no giant blobs form
  (the largest group in any world is 145 particles; experiment 2 had blobs up to 1,200).
- **More sheets, and the longest chains yet.** Laws 5, 8 and 11 put about a third of their
  particles in flat sheets. Law 11's chains average 9 particles, where every other law and
  experiment so far averaged 3 to 5.
- **Repeated arrangements spread across laws.** In every law, groups with the exact same
  arrangement of elements recur in at least one start (up to 46 particles' worth per world in law
  10), against 4 laws under experiment 3's rule. Law 5's big repeats are gone: it makes sheets instead.
- **A template now survives.** The probe built a 14-particle chain of two letters in a fixed
  order (in the laws whose lenses allow a code: each letter fits the spine with both letters and
  prefers the other at its side). In law 5 it stayed 92 to 100% intact for 3,000 ticks, where in
  experiment 3 such chains fell apart within about 1,000.
- **Partners lean toward the right letter, but no copy forms.** In a settled soup almost every
  particle is already bonded, so the chain finds few partners. With 120 building blocks freed
  around it, up to 10 of its 14 sites pick one up, and partners are the matching letter 45 to 70%
  of the time (chance is 50%; laws 5 and 62 lean right, law 155 does not). Kept warm by the optional seeded jitter, law 62 settles at about
  70%. But partners never link into a second chain longer than 4.
- **Why not yet, as far as the probe shows:**
  - *Building blocks link up on their own.* The spine bond is as easy for two free blocks as for
    two blocks held by the template, so the free ones form their own short chains and arrive as
    clumps rather than one at a time.
  - *Cold freezes mistakes in.* The soup cools until nothing moves, so a wrong partner never comes
    off. Warmth lets wrong partners leave, but enough warmth to help also breaks the template's
    own spine (law 62 at the higher jitter: down to 23% intact).
  - Copying needs the spine bond to be much stronger than the side bond, and linking to be easy
    *only* when two blocks are held side by side. Narrower faces might do both: an exact alignment
    is hard to hit by chance and easy when the template holds blocks in place. That is the next
    knob to test.
- **The books balance.** In all 48 worlds, total energy never rose by more than the light that
  came in over any 20-tick check.

Rerun the sweep with `PARTIAL=partial.jsonl node tools/sweep.mjs > sweep-results.json` (it saves
each world as it finishes, so a stopped run resumes; add the experiment 3 rows as `control` for
the map). The probe: `CODE=1 FEED=120 NOISE=0.06 LAWLIST=62 node tools/template.mjs`.

## Cheap checks toward multiplying

Three routes to multiplying might already be half there in this world, with no new rule. The
probes above test one of them (templating). `tools/checks.mjs` watches 48 ordinary worlds (12 laws
× 4 starts, 4,000 ticks) for the other two, and for whether a group's state carries its shape. It
only watches. Results are in `checks-results.json`.

- **Groups split all the time, but the halves don't inherit anything beyond chance.** There were
  19,167 splits of groups of 8 or more. Each half's mix of elements is as close to the parent's as
  a random handful drawn from the parent would be (0.70 to 0.92 alike, against 0.75 to 0.92 for
  the random handful), and no closer. Most halves dissolve or rejoin. In 526 splits (3%) both
  halves later sit in separate groups at least three quarters of the parent's size with nearly
  its mix, mostly in laws 5, 7 and 11, where a random handful already matches the parent at 0.86
  to 0.90; that looks like the world sorting into groups of one element rather than lineages.
- **Groups don't recruit.** Of 47,668 particles that joined a group of another element and stayed
  for 200 ticks, 50 turned into the group's element, and 40 of those were unsettled genomes in law
  12 that settled. Once a genome sits in its element's valley, its neighbors' pull doesn't move it
  out; the `depth` setting (how deep the valleys are) is what would change that.
- **A group's members speak with one voice, but not in a way that tells arrangements apart.**
  Within each element, which group a particle belongs to explains about 80% of the spread in its
  fast state (30 to 70% by chance), so bonded particles fall into a shared state. Where a particle
  sits (chain end or middle) explains almost none of it (at most 9%). The kind of shape matters in
  law 8 (28%, sheets against the rest) and a little in law 9 (11%). But two groups with the same
  members arranged differently are no further apart in average fast state than two with the same
  arrangement: identical structures settle into different shared states, depending on their
  history. So a coarse-grained blend would see makeup and a group's own state, which works like a
  memory, but not its arrangement.

Rerun with `WORLDS=1,2,3,4 PARTIAL=partial.jsonl node tools/checks.mjs > checks-results.json`.
