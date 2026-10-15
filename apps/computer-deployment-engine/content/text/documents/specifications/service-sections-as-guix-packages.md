# Specification of service sections as Guix packages

Status: proposed. Incident: `data/records/incidents/2026-10-15-crg-receives-no-release.json`. Builds on `2026-10-15-specification-of-the-target-closure-build.md` (which computes the closure) and on the skill `correct-by-construction-and-hermetic-builds`. Implementation repository: red-cup-engineering/computer-engineering-services-section, application computer-deployment-engine.

## 1. Requirement

R1. The generation that LAGOON places on a machine contains exactly the store items that the systemd user units of that machine need to run, and nothing else.
R2. A fault in a package that no unit of the machine depends on cannot fail, slow or change the generation of that machine.
R3. The generation is a function of declared, pinned inputs only: building it twice gives the same sha256.
R4. A unit that the generation lacks a dependency for is refused before the generation is copied to the machine, not discovered when the unit starts.

## 2. System architecture (SAS)

Three kinds of object, each addressed by content.

- Service-section package: one Guix package per service section repository (for example kalshi-engineering-services-section), defined in the guix channel pinned by `channels.scm`. Source: the section repository at a 40-hex commit. Declared inputs: the other service-section packages it imports (from its `package.json` `link:` edges, restricted to the edges its entry points actually import), and a fixed-output derivation holding the third-party npm packages of its own lock subgraph, each with the integrity hash already in `pnpm-lock.yaml`.
- Unit: a systemd user unit whose `ExecStart` is a store path inside exactly one service-section package or one of its inputs.
- Generation: a Guix profile of one machine. Its manifest is the list of service-section packages for the units that machine runs. Cold Red Gate's manifest for the Kalshi trading job (unit `the unit matching 'cold-red-gate-561-group-job-kalshi-*.service' that runs the Kalshi trading job`) lists the Kalshi trading-job package only.

The superrepo bare-cedar-fog stays the place where sections are organized as source and where commits are pinned. It is not an input of any package. A package's source is its section repository, not bare-cedar-fog.

## 3. High-level design (HLD)

H1. Closure by package graph. The closure of a unit is the transitive closure of the package inputs, computed by Guix (`guix gc --requisites`), not by pnpm over the pnpm project. The pnpm lock is read once, by `target-closure.mjs`, to emit each package's input list; the emitted list is committed and checked, never hand-edited.
H2. Cycles are one node. The measured 87-package strongly connected component in prod dependencies (`content/research/2026-10-15-lock-closure-measurement/scc.py`) cannot be split across packages, since Guix packages form a DAG. `target-closure.mjs` collapses each strongly connected component to one package; a unit whose entry imports into a component pays for the whole component and no more. Whether the Kalshi trading-job entry point touches the component is measured first (task `lagoon-builds-from-a-target-closure`, work-item 1); if it does not, the component never enters the generation.
H3. Hermetic build. Each package builds in a Guix build container with no network; the npm packages come from a fixed-output derivation fetched ahead of time (`pnpm fetch` or the registry.561.group mirror) and hashed. This replaces the unfiltered `pnpm install --frozen-lockfile` of the justfile recipe `fabricate`.
H4. Per-package runtime. `compile-node-runtime.mjs` compiles the entry points of one package, not 45 entry points into one runtime; Cold Red Gate and the laptop each get the packages of their own units.
H5. Pre-copy check. Before `guix copy`, LAGOON runs `check-generation-closure` (section 5) over the generation and the unit files and refuses to copy on any violation (R4).

## 4. Low-level design (LLD)

L1. `scripts/target-closure.mjs --lock pnpm-lock.yaml --entry <path> --emit guix-inputs` reads the lock and the entry point's imports (the measurement in `imports.mjs`), and prints for the section: input section packages, and the third-party snapshot list with integrity hashes, sorted. Same input, same bytes.
L2. A Scheme module `(lagoon packages sections)` defines `(section-package name commit hash)`: `git-fetch` source at `commit`, `trivial-build-system` running node with `--offline` against the fixed-output store, outputs `lib/node_modules/<name>`.
L3. `check-generation-closure GENERATION UNITS...` computes `guix gc --requisites GENERATION` and the union of requisites of each unit's `ExecStart` store path and its declared `Environment`/`WorkingDirectory` store paths. Violations: (a) a requisite of the generation not reached by any unit (R1), reported by name; (b) a store path a unit refers to that the generation lacks (R4).
L4. Guile and Node stay the implementation languages already in the application; no new runtime.

## 5. Tests

T1. Closure equality: on the fixture the Kalshi trading job, the generation's requisites equal the union of the unit's requisites; the check exits 0. Delete one package from the manifest: the check exits 1 naming it (R4). Add one unreferenced package: exits 1 naming it (R1).
T2. Isolation (R2): break a section the Kalshi trading job does not import (introduce a syntax error in a copy of computer-data-engineering's entry); building the Kalshi trading-job package produces the same output hash as before the break.
T3. Hermeticity (R3): build twice with `--no-grafts --check`; the two sha256 sums are equal; the build record at `data/records/builds/<date>-kalshi-trading-job-package.json` passes `node scripts/check-hermetic-build.mjs`.
T4. Size: report the closure size in store items and bytes next to the whole-estate figures (809 importers, 1,349 snapshots); the target is the 40-importer, 24-leaf closure measured for the Kalshi trading-job entry point.
T5. Cycle: if the Kalshi trading-job entry point reaches the 87-package component, T4's report says so and the component is built as one package.

## 6. Order of work

1. Measure whether the Kalshi trading-job entry point reaches the 87-package component (read-only, scripts exist).
2. `target-closure.mjs --emit guix-inputs` with T1 on a fixture.
3. `(lagoon packages sections)` for the Kalshi trading job and its 40 importers; T3 and T4.
4. `check-generation-closure` wired before `guix copy`.
5. Cold Red Gate generation built from the Kalshi trading-job package only, released by the workflow `LAGOON deployment` in copy mode when the Leader names that action.
6. The other jobs of Cold Red Gate, then the laptop.

## 7. What this does not do

It does not change the source layout of bare-cedar-fog, and it does not retire the workflow's mode build for the rest of the estate until each target has its own package set. It does not substitute for the mitigation in the incident record, which does not wait for it.
