# Specification of service sections as Guix packages

Status: proposed. Incident: `data/records/incidents/2026-10-15-crg-receives-no-release.json`. Builds on `2026-10-15-specification-of-the-target-closure-build.md` (which computes the closure) and on the skill `correct-by-construction-and-hermetic-builds`. Implementation repository: red-cup-engineering/computer-engineering-services-section, application computer-deployment-engine.

## 0. What mathematics, standards and markets force

The Leader's method (2026-10-15): ask what mathematical law, standards conformance and market requirements force, then treat any disagreement with the code as a fault of the code. Each design choice below cites the one that forces it.

Mathematics
- M1. The set of store items a unit needs is the reachability set of its root in a directed graph of references. A generation that holds exactly that set is the least set closed under reference, so "exactly the units' dependencies" is a definition with one answer, not a judgement (graph reachability; Dolstra 2006, ch. 5, on the Nix store reference graph).
- M2. A package graph must be acyclic to be built in an order. A strongly connected component (here 87 packages, measured with scc.py) is condensed to one node; the condensation of any directed graph is acyclic (Tarjan 1972, "Depth-first search and linear graph algorithms", SIAM J. Comput. 1(2)). The condensed node is the smallest unit that can be built.
- M3. A store path names a function of its complete input closure by a hash of it, so equal inputs give equal paths and a different input cannot hide (content addressing; Dolstra 2006). Hence each build record and the comparison of two builds in R3.
- M4. Hoare triple {P} C {Q}: the precondition of switching a machine to a generation is that the generation's requisites are all present on the machine; the postcondition is that every unit's store paths resolve. `check-generation-closure` tests P before the switch.

Standards
- S1. GNU Guix substitute protocol: a node serves signed narinfo and nar files (`guix publish`), and a machine accepts a store item only if the signing key is in its `/etc/guix/acl`. The machine fetches what it lacks from a named substitute origin (`guix build --substitute-urls=...` or `guix pull`/`guix system reconfigure` on the host). This is the normal way a Guix machine receives software: the machine pulls; a sender does not need an ssh session into it.
- S2. systemd.unit(5): a unit declares its own dependencies (`Requires=`, `After=`, `ExecStart=` path). Whatever the unit file names is the unit's requirement; the generation must contain it and nothing else.
- S3. RFC 6920 Named Information (`ni:`) and W3C Subresource Integrity (sha-512 in `pnpm-lock.yaml` `integrity`): a third-party package is identified by the digest of its bytes, so the npm layer of a package is a fixed-output derivation keyed by those digests.
- S4. Semantic Versioning 2.0.0 and the npm package metadata (packument) format: sections reach each other by name and version through the registry `registry.561.group`; the registry design (content/text/documents/designs/2026-10-15-sas-hld-lld-of-serving-the-registry-from-any-node.md) makes that registry servable from any node, so no single host sits on the path.
- S5. Reproducible Builds definition (reproducible-builds.org/docs/definition): same source, environment and instructions give bit-identical artifacts; R3 is that definition applied.

Markets
- K1. A trading job that places orders on hourly markets must be running with current code at each hourly settlement boundary, and exactly one copy may bid on a market: the order identifier is slot-stable (kalshi-engineering-services-section #115) and the lease fences the holder (specification of the executor lease). A switch to a new generation is therefore one atomic profile switch followed by one unit restart, with rollback by the previous generation; a generation that needs a rebuild on the machine, or an ssh session that may drop mid-copy, risks a boundary missed.
- K2. Recovery must be bounded by the market cycle, not by the size of the repository. A closure of 40 importers is copied and verified in the time of one hourly cycle; the whole 809-importer lock is not. This is the market requirement that forces R1 and R2.
- K3. Real capital is at stake (rule: financial-production-judges-real-capital-effects), so a failed switch must leave the previous generation serving; a half-copied closure must be invisible until complete (store items are valid only when registered whole).

Where the existing code disagrees with these, the code is at fault. It disagrees in two places this specification names: the release workflow builds and copies the whole estate (against M1, K2), and it pushes the generation to Cold Red Gate by `guix copy --to` over ssh from the laptop runner (against S1 and the no-single-host decision: any node holding the state runs the work).

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
H5. Pre-publication check. Before a generation is published to a substitute origin, LAGOON runs `check-generation-closure` (section 5) over the generation and the unit files and refuses to publish on any violation (R4).

H6. Receiving is by pull (S1, K1). Any node that holds the built closure serves it with `guix publish`; Cold Red Gate fetches the generation's requisites from a named substitute origin, verifies the signatures against its `/etc/guix/acl`, then switches its profile and restarts the units. The laptop runner becomes one optional publisher among several rather than the only sender, which removes it, and the credential for an ssh session from it into Cold Red Gate, from the release path. The ssh route stays only as the bootstrap for a machine that has no origin to pull from. The substitute origin's address is data in the machine's deployment records; the registry for the npm layer is `registry.561.group` served from any node (the registry design).

## 4. Low-level design (LLD)

L1. `scripts/target-closure.mjs --lock pnpm-lock.yaml --entry <path> --emit guix-inputs` reads the lock and the entry point's imports (the measurement in `imports.mjs`), and prints for the section: input section packages, and the third-party snapshot list with integrity hashes, sorted. Same input, same bytes.
L2. A Scheme module `(lagoon packages sections)` defines `(section-package name commit hash)`: `git-fetch` source at `commit`, `trivial-build-system` running node with `--offline` against the fixed-output store, outputs `lib/node_modules/<name>`.
L3. `check-generation-closure GENERATION UNITS...` computes `guix gc --requisites GENERATION` and the union of requisites of each unit's `ExecStart` store path and its declared `Environment`/`WorkingDirectory` store paths. Violations: (a) a requisite of the generation not reached by any unit (R1), reported by name; (b) a store path a unit refers to that the generation lacks (R4).
L4. Guile and Node stay the implementation languages already in the application; no new runtime.

## 5. Tests

T1. Closure equality: on the fixture the Kalshi trading job, the generation's requisites equal the union of the unit's requisites; the check exits 0. Delete one package from the manifest: the check exits 1 naming it (R4). Add one unreferenced package: exits 1 naming it (R1).
T2. Isolation (R2): break a section the Kalshi trading job does not import (introduce a syntax error in a copy of computer-data-engineering's entry); building the Kalshi trading-job package produces the same output hash as before the break.
T3. Hermeticity (R3): build twice with `--no-grafts --check`; the two sha256 sums are equal; each build record at `data/records/builds/<date>-kalshi-trading-job-package.json` passes `node scripts/check-hermetic-build.mjs`.
T4. Size: report the closure size in store items and bytes next to the whole-estate figures (809 importers, 1,349 snapshots); the target is the 40-importer, 24-leaf closure measured for the Kalshi trading-job entry point.
T5. Cycle: if the Kalshi trading-job entry point reaches the 87-package component, T4's report says so and the component is built as one package.

## 6. Order of work

1. Measure whether the Kalshi trading-job entry point reaches the 87-package component (read-only, scripts exist).
2. `target-closure.mjs --emit guix-inputs` with T1 on a fixture.
3. `(lagoon packages sections)` for the Kalshi trading job and its 40 importers; T3 and T4.
4. `check-generation-closure` wired before publication to a substitute origin.
5. Cold Red Gate generation built from the Kalshi trading-job package only, published to a substitute origin and pulled by Cold Red Gate; until the pull path exists, the workflow `LAGOON deployment` in copy mode is the bootstrap route and needs the Leader to name that action.
6. The other jobs of Cold Red Gate, then the laptop.

## 7. What this does not do

It does not change the source layout of bare-cedar-fog, and it does not retire the workflow's mode build for the rest of the estate until each target has its own package set. It does not substitute for the mitigation in the incident record, which does not wait for it.
