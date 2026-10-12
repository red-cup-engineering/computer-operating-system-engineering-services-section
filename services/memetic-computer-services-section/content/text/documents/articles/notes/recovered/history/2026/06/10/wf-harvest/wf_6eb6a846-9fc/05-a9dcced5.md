# Wave 1 Design: the Settling Daemon + the Workbench (agent-consumer pressure)

Design only. Validated against the-ways.md, the 06-11 journal (Wave 1 definition), the cosmogony note, and the two grounding surveys. Primary user: an AI agent on this box that wants to articulate witnesses, read sections, and subscribe to settlement with one GET of discovery and zero out-of-band documentation.

---

## 0. Names and placement

- **Daemon**: `services/meme-topology-daemon` (`@emsenn/meme-topology-daemon`). One process per address root.
- **Workbench**: `apps/meme-topology-workbench` (`@emsenn/meme-topology-workbench`), binary `mtw`.
- **Protocol**: `lib/meme-topology-protocol` (`@emsenn/meme-topology-protocol`) — tiny, near-zero-dep: wire shapes (envelope, verdict, event, section), the charge wire term, and a thin fetch/SSE client. Both daemon and workbench depend on it; neither depends on the other. The protocol is itself a site (Way 7); putting its shapes in a lib keeps that honest and avoids an app→service dependency inversion.

Per the journal's naming convention, the JSON codec for attestations should be `lib` territory, not daemon territory (see Section 3, gap B).

---

## 1. The daemon

### 1.1 Process model

Single Node process (node>=22.18, ESM, matching the lib), single writer over one **address root** directory. Advisory lockfile `<root>/.daemon.lock` (pid + UDS path); a second daemon on the same root refuses to start; readers (workbench embedded mode) may open read-only.

Listens on two transports:
- **Unix domain socket** `<root>/.daemon.sock` — the preferred transport for local agents; the UDS peer's uid is usable provenance (the "genesis observer" bootstrap, 1.3).
- **TCP port** (config) — same routes; remote callers must carry recognized provenance like anyone else.

Boot = replay: stream the admission journal (1.2), decode attestations, `induce`, serve. Until the first settlement completes, all section routes answer **503** with a kind-tagged "not yet settled" body (newswire's honest-degraded pattern, kept). An optional carrier snapshot cache under the daemon namespace is a *reading* — deletable at any time, never authoritative (Way 1).

There is **no scheduler in the engine**. `setInterval` is rejected as a drive mechanism. Anything periodic (a clock conduit, a feed poller) is a *mounted conduit* that POSTs witness envelopes through the same front door as every other observer; its wall-clock readings are witnessed payload, never sequencing (Way 2). The daemon's tick fires when witnesses arrive, full stop.

Shutdown: stop accepting, fsync the journal, release the lock. Nothing is lost because nothing lived in fields — runs, errors, admissions, mounts are all cells in the daemon's own self-trace (Way 9); the newswire habit of `#runs`/`#lastError` private-field history is rejected.

### 1.2 Persistence

Floor adopted from `lib/posix-holography/src/fs/flatfile.mts` discipline: O_APPEND single-line writes, fsync-before-resolve, per-path append queue, torn-final-line tolerance, ENOENT-reads-as-empty, **no overwrite API exists**. Addressing entirely via `@emsenn/meme-topology-addressing`: the URL path, the directory path, and the term are one codec (`logPath`, `segment`/`termOf`) — the directory IS the address (Way 6).

Layout under `<root>`:

```
<subject-segments...>/<leaf>.jsonl     # per-subject witness logs (TTAM; logPath(root, term))
<daemon-ns>/journal/journal.jsonl      # admission journal: one line per envelope (transaction record)
<daemon-ns>/quarantine/quarantine.jsonl
<daemon-ns>/mounts/...                 # mount declarations, themselves attestation logs
<daemon-ns>/cache/carrier.json        # optional snapshot reading; deletable
```

`<daemon-ns>` is the reserved namespace term `["meme-topology.daemon", <daemon-id>]` rendered through `segment` (no hand-rolled `~daemon` strings; the addressing codec owns escaping).

**Transactional batch append** (supersedes holography's per-datom await): an envelope is first appended whole to the journal (its content id = `termKey` of its canonical encoding), then fanned out to per-subject logs with the envelope id on each row. Crash between the two phases is repaired at boot: journal entries whose fan-out is incomplete are re-applied — idempotent because every row id is content-derived (G-Set). The journal also gives SSE its replayability (1.6) and the engine its cursor: the daemon's read position is a byte-offset/row-id high-water mark **stored as a witnessed cell in the self-trace**, not a memory variable.

### 1.3 Admission path — "no witness, no world," enforced here

The lib (correctly) admits unprovenanced attestations; the gate is the daemon's job. Wire unit is the **witness envelope**:

```ts
interface WitnessEnvelope {
  readonly kind: "meme-topology.daemon.envelope";
  readonly observer: AddressTerm;            // who attests — REQUIRED
  readonly via?: AddressTerm;                // conduit path, if relayed
  readonly observedAt?: string;              // wall-clock TESTIMONY (data, never ordering)
  readonly attestations: readonly AttestationTerm[];  // JSON-codec'd (gap B)
}
```

Gate sequence, per envelope:

1. **Shape check** → malformed shapes are the *only* HTTP-error case (400 with a path-addressed reason). Way 3: exceptions for malformed shapes only.
2. **Provenance check** → the observer must itself be a recognized cell in the world: there must be a settled `(genesis-or-recognized-observer) recognizes (observer)` charge readable in the current carrier. Recognition is just attestations like everything else — observers are admitted and withdrawn as witnessed facts, never config constants (rejecting swarm's hardwired `ENDPOINTS`). Bootstrap: the daemon config names exactly one **genesis observer**; the UDS peer matching it (or a configured token for TCP) is recognized axiomatically, and everything else descends by `recognizes` chains.
3. **Unrecognized → quarantine, not rejection.** The envelope is appended verbatim to the quarantine log; the quarantine *event* is appended to the self-trace (rejection is evidence, Way 4). If the observer is later recognized, a quarantine replay sweep re-admits held envelopes. Nothing is ever silently dropped.
4. **Identity & idempotence**: each attestation's id = `termKey` of its canonical encoding; duplicates verdict as `"duplicate"` and are not re-appended.
5. Admitted attestations get the daemon's provenance frozen into the lib `Attestation.provenance` slot: `{ observer, via, observedAt, envelopeId, admittedAtOrdinal }` — opaque to the lib, recoverable for audit renders.

The admission **response is charge-shaped, not boolean** (see route 2 in Section 4): per-attestation verdicts an agent can act on, including a machine-actionable `remedy` for quarantine ("have a recognized observer affirm `recognizes(<you>)`").

### 1.4 The settling loop — a tick is an ordinal advance

```
admit envelopes (journal append, fan-out)        // 1.2–1.3
  → extend carrier with admitted attestations    // today: extend() = full induce; see gap A
  → compute CellChange[] vs previous carrier     // gap C; daemon fallback exists
  → append tick record to self-trace (ordinal, envelope ids, change count, settling classification)
  → emit SSE events derived from the journal
```

- **Reentrancy**: concurrent admissions are queued into the next tick's batch; concurrent *reads* during a tick see the previous settled world (the standing fixed point — newswire's collapse-to-current-world guard, kept and made honest).
- **The daemon ordinal is a term, not an integer.** Time is two-level until lib incremental settling lands: the global ordinal is the pair *(tick ordinal; lib settling-stage ordinal within the tick)*, lexicographic, encoded as a term (gap E). The journal row for tick *n+1* records `successor(<tick-n-term>)`. This is the honest workaround for the known lib limitation that each `induce` restarts its internal stages at `zeroOrdinal()` — the daemon keeps the accumulated descent in its self-trace, and when the lib's resumable settling arrives the two levels splice into one (the temporal-2-category's `α + β` advance, carried as a term so the strict linear case stays the degenerate case).
- **Honesty about fuel**: if a settling step is bounded (config max stages) and stops early, the tick record and all readings carry `regime: "partial-prefix"` (settling-orbit's discipline, kept verbatim); `fixedPoint` is claimed only when the closure judgment says so. `classifySettling` output (regime, depth, cofinality, limit stages, non-Scott firings) is part of every tick record — world health is a reading, not a vibe.
- **Performance posture, declared**: Wave 1 accepts `extend` = full recompute and O(n²) information scans. The engine seam is one interface (`SettlingEngine`, Section 3) so the incremental implementation swaps in without touching admission, serving, or events.

### 1.5 Section serving and renderings

Reads are **observer-relative readings over the one carrier**, addressed by the same term↔path codec as storage: `GET /sections/<seg>/<seg>/...` — the URL path is the address is the term (Way 6, `termOfNested` inverts it).

Query dimensions (all optional, all defaulted *and the default echoed back in the response* so no choice is silent):

- `order=knowledge|truth`, `bound=least|greatest` — the four fixed-point readings; or `reading=<name>` for a mount-declared preset.
- `render=audit|calm` — **default `audit`** (full receipts: charge + contributing attestations with provenance + the settling stage where each cell fired). `audit` is the lossless default; `calm` is the *declared* collapse to the rendering words (AFFIRMED / DENIED / CONTESTED / UNSETTLED) and is the only place those words exist. No carrier, no wire type, no storage row ever holds a collapsed word or a boolean (Ways 3 and 5; rejecting newswire's in-carrier `pubStatus: "usable"`).
- `where=stable|active|...` — filter an enumeration by charge; `GET /sections/<ns>?where=stable&render=audit` is the contradiction ledger, first-class and one URL away.

**Charge wire shape** — FOUR as named projection, never the assumed universe:

```ts
interface ChargeTerm {
  readonly kind: "bilattice.charge-term";
  readonly projection: "FOUR";              // the finite shadow, NAMED — widening is additive
  readonly value: "absurd" | "potential" | "active" | "stable";
  // future: projection: "<quantale-id>", value: <general residuated term> — no field is reshaped
}
```

An **unwitnessed cell is not a 404**: it reads as the knowledge-least charge (`absurd`) with zero witnesses, HTTP 200. 404 is reserved for routes that don't exist. The status-code contract, stated in the self-description so agents don't guess: 200 = well-formed question, charge-shaped answer (including quarantine, including contested, including absence); 400 = malformed shape; 503 = not yet settled; nothing else.

Content negotiation: `application/json` (default), `application/x-ndjson` (streaming enumerations and traces), `text/event-stream` (events), `text/plain` (one-line calm render for quick agent glances — requires explicit `render=calm`, since plaintext can't carry receipts).

### 1.6 Events — SSE as a reading of the journal

`GET /events` streams settlement events. The decisive design choice: **the SSE stream is fold(journal), not an in-memory buffer.** Every event is derivable from the admission journal + self-trace, therefore:

- `id:` on every event = the canonical tick-ordinal term (via `termKey`).
- `Last-Event-ID` resume **replays from the journal** — an agent that slept through a hundred ticks reconnects and receives exactly the missed events, in order, then goes live. Time only accumulates; subscriptions inherit that for free.
- Event types: `tick` (ordinal, classification, change count), `cell-changed` (cell term, before/after `ChargeTerm`, firing attestation ids), `quarantine`, `mount`, `recognition`. Filters: `?within=<term-path>` (namespace), `?cell=<addr>` (repeatable), `?events=cell-changed,quarantine`.
- `cell-changed` payloads carry receipts (firing attestation ids) so an agent can react without a follow-up GET in the common case.

### 1.7 The mount model — one descent, many worlds

A mount is **vocabulary + readings + codecs + conduits attached at a namespace term**. It contributes zero code to the settling path. Mounting is itself admission: the manifest is articulated as attestations into the daemon namespace, through the same provenance gate, so "what is mounted" is a settleable, auditable cell like everything else (Ways 7 and 9).

```ts
interface MountManifest {
  readonly kind: "meme-topology.daemon.mount";
  readonly namespace: AddressTerm;                 // composeTerm(ns) prefix the mount owns
  readonly vocabulary: readonly AttestationTerm[]; // predicate decls + `specializes` axioms — just attestations
  readonly readings: readonly ReadingDecl[];       // named presets: { name, order, bound, within?, where?, description }
  readonly codecs: readonly CodecDecl[];           // { mediaType, direction: "pull"|"push", lossReport: "none"|"declared", description }
  readonly conduits?: readonly ConduitDecl[];      // witness producers: { name, observer, description } — run OUTSIDE the engine, POST through the front door
}
```

- **Vocabulary** is attestations (`specializes`, predicate declarations) — the lib's `specializes(special, general)` facade is exactly the right primitive; a mount's axioms enter the same carrier and settle with everything else.
- **Readings** are query presets over the one engine — never logic. `GET /sections/...?reading=news.publishable` resolves to (order, bound, within, where) the mount declared.
- **Codecs** in Wave 1 are declarations plus at most pure encode/decode at the HTTP boundary; the full geometric-morphism carrier (pullback/pushforward/residue) is the lib's Wave-1 site-morphism deliverable — `CodecDecl.lossReport` is the slot it will fill. No mount may register an "export"; only pushforwards that will report what they killed.
- **Conduits** are ordinary recognized observers that happen to be processes (a timer, an fs-watcher, a feed reader). The daemon may *supervise* conduit child processes as a convenience, but their output enters via `POST /witnesses` like any agent's. This is how "periodic" exists without the engine owning a clock.

### 1.8 Self-description — the daemon describing its own mounts

`GET /` returns everything an agent needs, computed as a reading over the self-trace (not a hand-maintained doc):

```jsonc
{
  "kind": "meme-topology.daemon.description",
  "daemon": { "id": ..., "root-term": ..., "ordinal": <term>, "settled": true, "classification": {...} },
  "contract": { "status-codes": {...}, "charge": { "projection": "FOUR", "values": [...] },
                "render": { "default": "audit", "calm-is-declared-collapse": true } },
  "mounts": [ { "namespace": [...], "readings": [...], "codecs": [...], "conduits": [...] } ],
  "vocabulary": { "predicates": [...], "specializations": [...] },   // folded from the carrier
  "routes": [ { "method": "GET", "path-template": "/sections/{...term}", "params": {...}, "description": ... }, ... ],
  "genesis-observer": [...], "recognition-predicate": [...]
}
```

One GET, full ceremony eliminated. `GET /vocabulary` and `GET /readings` serve the subsections individually for cheap re-checks.

---

## 2. The workbench

One binary `mtw`, three faces over the same primitives; **agent-first means the scriptable face is the primary face**.

**Modes**
- `--daemon <url|uds>` (default: discovered from `<root>/.daemon.lock`, env `MT_DAEMON`): thin client over the protocol lib.
- `--root <dir>` embedded: operates lib/meme-topology directly over the identical on-disk layout — no daemon required ("at rest it is the topology on disk"). Refuses write mode if the lockfile is held; read-only coexistence allowed. Embedded and daemon modes share one command surface, so a script written against a directory works unchanged against a service.

**CLI — verbs are the gerunds plus readings:**

```
mtw affirm <subject> <predicate> [object] [--as <observer>]   # articulate
mtw deny   <subject> <predicate> [object] [--as <observer>]
mtw specializes <special> <general>
mtw read  <term...> [--reading <name> | --order k|t --bound least|greatest] [--render audit|calm]
mtw section <namespace> [--where stable] [--render ...]       # enumerate
mtw watch [<namespace>] [--since <ordinal-term>]              # SSE tail, resumable
mtw trace <term...>                                            # raw receipts, JSONL
mtw mounts | mtw vocab | mtw readings | mtw ordinal | mtw quarantine
mtw tick --once                                                # embedded mode: drain + settle once
```

- **Output**: JSON by default when stdout is not a TTY (agents never pass a flag to get machine output); human tables/colors only on TTY. `--json` forces.
- **Exit codes carry transport truth only**: 0 = the question was answered (whatever the charge — a CONTESTED read is a *success*); nonzero = malformed input or transport failure. The swarm habit of exit-codes-as-charge is rejected. For shell ergonomics, `mtw read ... --expect active` exits 1 on mismatch — a declared collapse at the declared edge.
- **Provenance**: observer identity from `MT_OBSERVER` env / config / `--as`; every articulation carries it; there is no unprovenanced path through the workbench at all.

**TUI** (`mtw` bare on a TTY): a section browser. Left pane: the namespace tree (which is literally the directory tree — the address codec again). Main pane: cell grid with charge glyphs (`·` absurd, `+` active, `−` denied-side, `⊤` stable). Bottom pane: the selected cell's witness log. Live via the same SSE the agents use. Keys: `a` toggles audit/calm (the toggle is the *declared* choice surface), `:` opens an articulation line (`:affirm sky color blue`), `g` jumps to a term, `q` shows the quarantine ledger, `o` the ordinal/classification health line. The 06-11 journal's "program processor morphism language" embryo can graft onto the `:` line later; Wave 1 ships only affirm/deny/specializes/read there.

---

## 3. The seam with lib/meme-topology — what it must expose; gaps flagged

The daemon calls the lib only through one internal interface, so the in-flight refactor and the later incremental engine are absorbed at a single point:

```ts
interface SettlingEngine {
  induce(attestations: readonly Attestation[]): MemeTopologyCarrier;
  extend(carrier: MemeTopologyCarrier, delta: readonly Attestation[]):
    { carrier: MemeTopologyCarrier; changes: readonly CellChange[]; regime: SettlingClassification };
}
```

Wave 1 ships `RecomputingEngine` (wraps today's `extend`, computes `changes` itself); the lib's incremental settling drops in as `ResumableEngine` later, same shape, including the ordinal splice.

**Gaps, ranked (A–B block implementation; C–F have daemon-side fallbacks):**

- **A. Incremental settling** — already a declared Wave-1 lib deliverable. Daemon does not block on it (RecomputingEngine), but the tick ordinal design (1.4) pre-commits the splice point: the lib's resumable API must accept a starting ordinal term so stages accumulate instead of restarting at `zeroOrdinal()`.
- **B. Attestation JSON codec — HARD BLOCKER.** No persistence, no wire, no replay without it. `Mark`/`Token`/`Claim` are classes (`markOf` rejects plain objects; prototypes die on JSON round-trip); nothing in lib or `meme-topology-addressing` encodes an `Attestation`. Needed: `encodeAttestation(a): AttestationTerm` / `decodeAttestation(t): Attestation`, canonical (key-sorted, `termKey`-compatible) so content identity agrees between wire, disk, and engine equality; declared rejection of the un-encodable value universe (functions, symbols). Recommended home: a lib subpath (`@emsenn/meme-topology/attestation-codec`) because identity must agree with engine internals — flag to the lib workflow as the top cross-workflow request.
- **C. Carrier diff**: `carrierDelta(before, after): readonly CellChange[]`. Today only `settlingClosureEquivalence` exists (boolean-ish "did it change"). Daemon fallback: walk both carriers' information `entryCarrier`s and compare `readCharge` per (point, state) — O(n²), acceptable Wave 1; lib helper requested.
- **D. Receipts per cell**: `witnessesOf(carrier, cell): readonly Attestation[]` for the audit render. Fallback: coincidence scan over `carrier.witnesses`. Requested as a lib query so receipts stay correct if internal indexing changes.
- **E. Ordinal term codec**: `ordinalTerm(o): AddressTerm` / inverse, for zero/successor and *labeled* limits (a `LimitOrdinal`'s function-valued `fundamentalSequence` cannot serialize; serialize the label + the position taken, flag the general case as future). Could live in the protocol lib if the lib team declines.
- **F. Charge projection discriminator**: the `ChargeTerm` wire shape (1.5) lives in the protocol lib for Wave 1, but the lib should eventually own the `projection` naming so the residuated generalization (cosmogony note's q ≠ 1 demand) is a pure widening.
- **Confirmed sufficient as-is** (per survey, root barrel): `induce`/`extend`, `affirm`/`deny`/`specializes` + `AdmissionOptions.provenance` (opaque slot — the daemon's gate metadata rides there), `readCharge` + the four `MemeTopologyFixedPointReading`s, `classifySettling`, `settlingFirings`/`SettlingFirstCohomology` (powers the event payloads and H¹/`coordinationFree` reading), `predicationValuationClosureProcess` (the warm-start seam the ResumableEngine will use). Watch item: the Witness→Attestation rename is uncommitted; the protocol lib should import types, never restate them.
- **Addressing**: used as-is; it is exactly the path/term codec the routes, storage, and CLI all share. No changes requested.

---

## 4. API sketches — the 12 load-bearing operations

Protocol-lib shapes referenced throughout:

```ts
type AttestationTerm = /* canonical JSON encoding of Attestation (gap B) */;
type OrdinalTerm = AddressTerm;        // canonical ordinal encoding (gap E)
interface ChargeTerm { kind: "bilattice.charge-term"; projection: "FOUR"; value: "absurd"|"potential"|"active"|"stable"; }
interface CellChange { cell: AddressTerm; before: ChargeTerm; after: ChargeTerm; ordinal: OrdinalTerm; firedBy: readonly string[] /* attestation ids */; }
```

1. **Discover** — `GET /` → `DaemonDescription` (1.8). 503 pre-settlement, with the same kind-tagged body minus carrier-derived fields.
   `describe(client): Promise<DaemonDescription>`

2. **Admit witnesses** — `POST /witnesses` body `WitnessEnvelope` →
   ```ts
   interface AdmissionResult {
     kind: "meme-topology.daemon.admission-result";
     ordinal: OrdinalTerm;                       // tick this batch advanced to (absent if fully quarantined)
     verdicts: readonly AdmissionVerdict[];      // per attestation
     changes: readonly CellChange[];             // what settled differently
     regime: "fixed-point" | "partial-prefix";
   }
   interface AdmissionVerdict {
     id: string; outcome: "admitted" | "duplicate" | "quarantined";
     charge: ChargeTerm;
     remedy?: { missing: AddressTerm; suggestion: string };   // machine-actionable
   }
   ```
   Always 200 if well-formed (quarantine is a domain value); 400 only for malformed shape, with a path-addressed reason.
   `admit(client, envelope): Promise<AdmissionResult>`

3. **Read a cell** — `GET /sections/{...term}?order&bound&reading&render` →
   ```ts
   interface SectionReading {
     kind: "meme-topology.daemon.section";
     cell: AddressTerm; charge: ChargeTerm;
     reading: { order: "knowledge"|"truth"; bound: "least"|"greatest"; name?: string };  // echoed, never silent
     ordinal: OrdinalTerm;
     receipts?: readonly { attestation: AttestationTerm; provenance: ProvenanceTerm; firedAtStage?: OrdinalTerm }[]; // render=audit
     calm?: "AFFIRMED"|"DENIED"|"CONTESTED"|"UNSETTLED";       // render=calm only
   }
   ```
   Unwitnessed cell → 200, charge `absurd`, empty receipts.
   `read(client, term, opts): Promise<SectionReading>`

4. **Enumerate a section** — `GET /sections/{...namespace}?where=stable&render=audit`, `Accept: application/x-ndjson` → stream of `SectionReading`. The contradiction ledger is this route with `where=stable`.
   `section(client, ns, opts): AsyncIterable<SectionReading>`

5. **Subscribe** — `GET /events?within&cell&events`, `text/event-stream`; `id:` = ordinal term; `Last-Event-ID` resumes from the journal fold (1.6).
   `events(client, opts & { since?: OrdinalTerm }): AsyncIterable<SettlementEvent>`

6. **Raw trace** — `GET /trace/{...term}` → the subject's witness log as JSONL, byte-faithful to disk. The audit floor: an agent can always drop to receipts.
   `trace(client, term): AsyncIterable<JournalRow>`

7. **Ordinal / health** — `GET /ordinal` → `{ ordinal: OrdinalTerm, classification: SettlingClassification, firstCohomologyRank: number, coordinationFree: boolean }` — H¹ exposed so coordination cost is computed, not argued (Way 8).
   `ordinal(client): Promise<OrdinalReading>`

8. **Mount** — `POST /mounts` body `MountManifest` → `AdmissionResult` (a mount IS an admission; same gate, same verdict shape). `GET /mounts` lists, folded from the self-trace.
   `mount(client, manifest): Promise<AdmissionResult>`

9. **Vocabulary discovery** — `GET /vocabulary[?within=<ns>]` → predicates + specialization lattice folded from the carrier; `GET /readings` → all named reading presets with descriptions.

10. **Quarantine ledger** — `GET /quarantine` → held envelopes with their quarantine evidence; `POST /quarantine/replay` (recognized observers only) → re-gates held envelopes after a recognition lands, returning `AdmissionResult[]`.

11. **Recognize an observer** — sugar route `POST /observers` body `{ observer, by }` → composes the `recognizes` attestation and admits it; equivalent to operation 2 with the right predication, exposed because it is the single most common ceremony a new agent hits. Response includes which quarantined envelopes became admissible.

12. **Tick introspection / once-mode** — `GET /ticks?since=<ordinal>` → tick records (ordinal, envelope ids, change count, regime) from the self-trace — the daemon's run history as data, replacing snapshot-endpoint mutable counters. In embedded/workbench mode the same operation is `mtw tick --once`: drain pending, settle once, print the `AdmissionResult` — newswire's separable `tick()` kept, with the engine inverted to witness-driven.

---

## 5. Doctrine checklist and open questions

Checklist (each rejected habit from the precedent survey, addressed): wall-clock never sequences (envelope `observedAt` is testimony; tick identity is the ordinal term) — no `setInterval` engine (conduits are observers) — no mutable service history (self-trace; routes 7/12 are readings of it) — no single-upstream full-replace (multi-observer envelopes, monotone journal) — provenance verified, not shape-checked (recognition chain + quarantine) — no collapse inside carriers (calm only at `render=calm`; FOUR carried as named projection) — no forked engines (mounts are vocabulary/readings/codecs/conduits only) — no aspirational imports (everything in Section 4 is buildable against today's lib plus gap B).

Open questions for the human / lib workflow:
1. **Gap B ownership** — attestation JSON codec in lib proper vs a sibling package; daemon implementation cannot start persistence without it. Strongly prefer in-lib so identity agrees with engine equality.
2. **Genesis observer policy** — UDS-peer-uid as axiom is proposed; confirm acceptable for this box, and whether TCP gets a token or stays recognition-only.
3. **Quarantine replay authority** — proposed: any recognized observer may trigger replay (the gate re-runs anyway); confirm.
4. Package scope (@emsenn vs @561-group) — already on the journal's governance list; protocol lib inherits the answer.