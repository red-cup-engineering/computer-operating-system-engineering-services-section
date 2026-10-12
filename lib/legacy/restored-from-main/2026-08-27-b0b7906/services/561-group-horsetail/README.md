# @561-group/horsetail

Horsetail — the 561-group computer's native programming language, a **paraconsistent settling
Lisp** where `eval` IS `settle` and top (⊤) is a bindable HELD value, never an error. See
`horsetail/README.md` for the language itself (the reader, the evaluator's special forms, the
charge algebra) and `principal/README.md` for the OS identity tool it can act `as`.

## Recovery notes

This package did not exist in the live tree; it is recovered from git history. `computer/horsetail`
was introduced at `fc667672d50` (2026-06-05, "57/57"), grew to "meet-or-beat Fennel parity, 127/127"
at `feee77e2055`, then went through an in-flight rearchitecture (`3594d7a4c55`, `d1105016183`,
`cd6b4e97704`) before the whole `computer/` tree was archived at `31a9e94b0bb`
("archive computer/ ahead of repopulating from the new layout") — a repopulation that never happened
for horsetail. `@561-group/computer` was later rebuilt from scratch as a much smaller 0.0.1 -> 0.0.2
package covering only "the coherent subset exercised by active consumers" (see that package's own
README), which does not include horsetail, principal, distribution, process-runtime, or
typed-filepath-addressing-system. The only surviving trace in the live tree was a documented stub:
`.../computer-game-system-services-section/services/tsander/src/horsetail-hook.mjs`, whose header
explains the cut and stubs `runProgram` to a deterministic "no signal" (⊥) rather than faking a real
evaluation.

Recovered here from the LAST commit before the archive (`cd6b4e97704`), not the 127/127 commit
(`feee77e2055`), to keep the most-evolved version — with one caveat: at `cd6b4e97704`,
`horsetail/src/_substrate.mjs` still pointed at posix-holography's pre-flatten deep `library/...`
path even though that same commit's own diff flattened posix-holography into `src/*.mjs` — an
in-flight-refactor oversight (only `horsetail/README.md` was touched by that commit, not this file).
That means horsetail's own tests could not have passed at the exact final commit. Fixed here as a
single-line repoint to the (now cross-package) `@561-group/computer/posix-holography/eavt-substrate`
module, which exports the same names — see `horsetail/src/_substrate.mjs`'s "RECOVERY NOTE".

### The math dependency was renamed while horsetail was in the archive

The recovered sources imported `@561-group/math`, which is the name that package carried before
`d416a42175f` ("rename math core to metrologic", 2026-08-26). It is now
`@lenticule-science/metrologic`, lives at
`science-services-section/.../obsmetrological-services-section/apps/metrologic`, and is
git-tracked there.

Every reference has been repointed. This was a rename, not a fork: for the modules horsetail uses,
`bilattice/src/{charge,descent,cone,void,internal}.mjs` and `chu/src/{chu,chu-transform}.mjs` are
byte-identical between the two, and the only differences in the barrels and `chu/src/four.mjs` are
the package's own name in comments and one internal import specifier. Version `0.1.0` is pinned
exactly, matching `@561-group/computer` and every other live consumer, so npm resolves one shared
copy rather than two.

This mattered beyond tidiness. Before the repoint, this package was the **only live package in the
tree still depending on `@561-group/math`** — every other dependant on that name sits under a
`lib/legacy/` path. Recovering code from before a rename reintroduces the old name silently, and a
package name with no maintained source behind it is exactly the condition that made horsetail
invisible to the reorganization in the first place.

Placed as its OWN package — sibling to `@561-group/computer`, not re-inserted as a subpath of it —
because `@561-group/computer`'s README states its public surface is "deliberately the coherent
subset exercised by active consumers" and that "historical experimental tiles remain in Git history
rather than becoming undeclared or unshipped exports." Historically horsetail WAS a subpath,
`@561-group/computer/horsetail` (see `tsander`'s stub and its legacy pre-port `horsetail-hook.mjs`,
recoverable at
`.../computer-engineering-services-section/.../computer-game-system-services-section/lib/legacy/.../horsetail-hook.mjs`);
un-stubbing tsander against this package instead requires only a specifier change
(`@561-group/computer/horsetail` -> `@561-group/horsetail`), not a behavior change — see "Un-stubbing
tsander" below.

Alongside horsetail's own two tiles (`horsetail/`, and `principal/` which one of horsetail's `as`
tests exercises), this package recovers `process-runtime/` (`allocation.mjs`, `process.mjs`,
`judgment.mjs`) and `typed-filepath-addressing-system/` (`address.mjs`, `access.mjs`) that
`principal.mjs`'s real (non-stubbed) implementation needs at import time. These are recovered as
support files only — not as full re-instatements of those tiles' own larger surfaces or test suites,
which remain further lost work (see the top-level archaeology report for this session).

`distribution/` was recovered here too at first, for the same reason, but has since moved to its real
home: `@561-group/computer` 0.0.4 ships it as `./distribution`, with a test suite covering the
federation laws and the L10a admission gate. The evaluator's own comments always called it
"computer/distribution", `federate.mjs` imports only from computer, and tsander's world now reads it
from there — so keeping a second copy in the language package would have been exactly the kind of
duplicate-with-no-single-home that lost this code in the first place. `horsetail/src/_distribution.mjs`
and `principal.mjs` name the computer path now, and this package no longer re-exports `./distribution`.

### Test results (recovered, run against this package as placed)

- `horsetail/tests/run.mjs` — the original LAW proof suite: **62/62 passed** (grew from "57/57" at
  introduction to 62 by the final pre-archive commit).
- `horsetail/tests/parity.mjs` — the "meet-or-beat Fennel" suite: **70/70 passed** (grew from
  "127/127" claimed at `feee77e2055`; the two suites were reorganized between that commit and
  `cd6b4e97704`, so the total check count differs from either historical commit message — both
  are fully green as recovered).
- `principal/tests/principal.test.mjs` — **17 passed**.

Run `npm test` after `npm install` (needs `@561-group/computer` and `@561-group/math` from the
registry).

### Un-stubbing tsander

`horsetail-hook.mjs` in `@red-cup-engineering/tsander` is written against a real Horsetail and
already matches this package's exported surface exactly (`world, run, fourName, glyph` from the
main entry point) — see the byte-identical legacy copy at
`.../computer-game-system-services-section/lib/legacy/2026-06-17-archive-emsenn-net/dev/ref/src/from-content-source/apps/tools/tsander/src/horsetail-hook.mjs`.
To un-stub it: (1) add `"@561-group/horsetail": "^0.0.1"` to tsander's `package.json` dependencies
(dropping nothing — `@561-group/computer` stays, for `world.mjs` and others); (2) change the one
import line in `horsetail-hook.mjs` from `"@561-group/computer/horsetail"` to
`"@561-group/horsetail"`; (3) swap `makeComputer`/`runProgram`'s bodies for the legacy versions
linked above (`branchOnCharge` is already identical and needs no change). This was NOT done as part
of this recovery: tsander's `tests/prove-horsetail.mjs` asserts the STUB CONTRACT itself (e.g.
`r.four === "bot"`, `r.error.includes("horsetail")`) — un-stubbing would need that test file rewritten
to assert real evaluation instead, which is a genuine behavior/test-semantics change, not a small
mechanical one.
