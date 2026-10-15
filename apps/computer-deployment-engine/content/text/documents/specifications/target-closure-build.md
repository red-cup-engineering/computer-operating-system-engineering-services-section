# Specification of the target-closure build

Status: specification, 2026-10-15. Requirement: `deploy-is-built-from-the-targets-own-closure` (561-group/soft-grass-pebble, content/requirements). Evidence: `content/research/2026-10-15-why-the-lagoon-build-is-the-whole-estate.md` in 561-group/soft-grass-pebble. Owner of the build: LAGOON (`computer-deployment-engine`, red-cup-engineering/computer-engineering-services-section). Raised by the Leader, 2026-10-15T04:12Z.

## 1. System architecture specification (SAS)
**Problem.** Every deploy builds the whole estate: a recursive checkout of every gitlink, an unfiltered `pnpm install --frozen-lockfile` (809 workspace importers, 1,349 external snapshots), and one 45-entry runtime shared by every machine. The Kalshi desk's code imports 9 leaf packages (40 importers, 24 externals); its declared dependencies reach 205 importers because the production dependency graph contains an 87-package cycle.

**Decisions.**
1. A *target* is the unit of build: a named set of entry points for one machine role (first: `kalshi-desk`, entries `kalshi-desk.mjs`, `kalshi-desk-review.mjs`, `shadow-score.mjs`, `weather.mjs`, `kalshi-sources.mjs`, `category-shadows.mjs`). A machine's deploy is the union of the targets it runs, not "the common software".
2. The superrepo stays the home of **source**. A build checks out only the repositories that contain its closure's importers.
3. The closure is **computed and published as a receipt**, from the lock, then **checked against the code**: declared-but-unimported workspace dependencies are reported, and a cycle in production workspace dependencies fails the gate.
4. The registry stays the end state for "the common package release" (rule `production-uses-guix-pnpm-and-the-house-registry`): once a package's owner publishes it, a target installs it by version and needs no checkout of it at all. The closure build is the step that gets there without waiting for every package to be published.
5. The systemd/Guix machine layer (`scripts/guix-deployment.scm`) is unchanged by this; only what it wraps changes.

**Non-goals.** No change to credentials, state conversion, first-cutover or rollback. No claim about build time or bytes until measured (Test 1).

## 2. High-level design (HLD)
Stages, each with an input, an output, and a receipt:
1. **closure** — in: target declaration, `pnpm-lock.yaml`; out: `closure.json` = importer paths, the repository (gitlink path) each lives in, external snapshot keys. Pure function of the lock; no network.
2. **admit** — in: `closure.json`, the code of the entry files; out: pass/fail receipt. Checks: (a) no cycle among production `link:` edges inside the closure; (b) every declared workspace dependency in the closure is imported by some reachable file, else reported (initially a warning, then a failure per package once its owner has cleaned it).
3. **checkout** — in: `closure.json`; out: a source tree containing exactly the listed gitlinks, each at its recorded commit (`git submodule update --init -- <path>` for each, after the owning ancestors' trees). A partial tree that the lock still names is the error case.
4. **install** — `pnpm install --frozen-lockfile --filter '<target-root>...'`, where `<target-root>` is a package that depends on the target's entry packages, so only the closure installs.
5. **compile + wrap** — `compile-node-runtime.mjs` over the target's entries only; then the existing Guix wrap.

Interfaces: a `targets/<name>.json` declaration beside each machine definition (entries and, for traceability, the machine role); `closure.json` and the admit receipt are build outputs retained next to `generation.json`.

## 3. Low-level design (LLD)
- `scripts/target-closure.mjs` (LAGOON): reads `pnpm-lock.yaml`, walks `importers` over `link:` edges and `snapshots` over `dependencies`/`optionalDependencies` exactly as `content/research/2026-10-15-lock-closure-measurement/closure.py` in 561-group/soft-grass-pebble does (reference implementation; the Node version must reproduce its numbers on `bbb4858`: 256/571 for `bare-cedar-fog-services-section`, 205/474 for `kalshi-stake-path-service`).
- Cycle check: Tarjan SCC over the closure's production edges; fail with the member list (reference: `scc.py`, 87 members on `bbb4858`).
- Import check: the regex walk in `imports.mjs` is the reference; the build version should use the same resolver `compile-node-runtime.mjs` already uses, so "used" means what the compiler sees. Dynamic `import()` with non-literal arguments are reported as unknown, never as unused.
- Checkout: map each importer path to its owning gitlink by walking `git ls-tree` for mode `160000` from the root; checkout is per gitlink with `--depth 1`.
- Release workflow: replace the unfiltered `just fabricate` with `just fabricate-target <target> <output>`; `release.yml` runs it for each target a machine declares. `CRG_REVISION` stays until the separate requirement `cold-red-gate-release-is-one-step` is met.
- Workspace cycle removal is **not** done in LAGOON: each cycle edge that is declared but unimported is removed by a PR in the package's owner repository, found by the admit report.

## 4. Tests (written before the code is trusted)
1. **Closure numbers**: `target-closure.mjs` reproduces the table in the research record on a recorded lock; any difference fails the test.
2. **Cycle gate**: on a fixture lock with a three-package cycle, admit fails and names it; on the Kalshi desk target after cleanup it passes.
3. **Equivalence**: the desk built from its closure and the desk built from the full tree produce the same compiled entry outputs for the six entries (hash of each compiled file), so a smaller build is not a different program.
4. **Smoke**: the six entries start and answer `--help` or a dry run from the closure-built runtime.
5. **Measured, then claimed**: each stage's wall time and bytes are recorded in the receipt; no spec or status text states a saving until a receipt shows it.

## 5. Order of work and who does it
1. `target-closure.mjs` and its tests in LAGOON (pure, no network, can start now; unaffected by tonight's cutover).
2. Admit report on the Kalshi desk target; send the list of declared-but-unimported edges to the owners of `forecasting`, `kalshi-services-section`, `mandate-portfolio-allocation-service`, `assist`, `communicating`, `gaming`.
3. `fabricate-target` in the justfile and `release.yml` after Codex's #830 lands, because #830 edits the same workflow; the two are coordinated through this record, the research record, and a note on #830.
4. A Cold Red Gate deploy then builds one target, not the estate.

## 6. Not decided here
Whether the closure receipt belongs in the Guix output or beside it; whether the laptop's other services become targets in one pass or one at a time; whether the registry-published path (SAS decision 4) replaces checkout per package or only for packages whose owners publish.
