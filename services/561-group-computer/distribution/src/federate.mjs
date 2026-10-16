// federate — the coordination-free FEDERATION layer: the tensor ∥ of two append-only worlds.
//
// THE LAW for this file. State is an append-only trace of {e,a,v,t} rows; identity is content
// (jcs->rowId). A world is a MAP from a subject `e` to its log — the ordered list of rows whose
// physical home is that subject. Two worlds federate by a G-Set UNION of each log, deduped by
// content-id: identical rows collapse to one, differing rows ALL survive. There is NO coordinator,
// NO clock, NO last-write-wins. Conflicting facts do not race — they are both kept, and the per-
// observer read-lens (settle/section, from L3 substrate) folds the contradiction to ⊤, a HELD value
// carrying BOTH witnesses. That is CALM (consistency-as-logical-monotonicity: union is monotone, so
// no coordination is needed) and paraconsistent (disagreement is a value, never an error).
//
// L10a — FEDERATION ADMISSION CONTROL (the trust gate). A naive G-Set union folds EVERY incoming row
// as fact, so a hostile peer can assert the converse of everything and force ⊤ everywhere — the
// sybil ⊤-injection DoS (spec §L10a, §3 call 9). The gate closes it: each incoming row is checked for
// PROVENANCE (it carries a witness/source we can read) and RECOGNITION (that source is a recognized
// principal, per a recognition PREDICATE-OR-CONE the CALLER passes in — never a baked policy). A
// verified+recognized row is admitted into the folded log (it may settle as fact, including a genuine
// ⊤ when two RECOGNIZED peers honestly disagree — honest conflict is NOT over-gated). An unverified or
// unrecognized row enters at ⊥ standing — held in a quarantine the read-lens does NOT fold (present,
// inert, never fact) — or, with opts.onReject:'f', is refused with a recorded f-fault carrying the
// reason. Either way it NEVER joins the knowledge join as fact. The gate is OPTIONAL: with no
// recognition test the behavior is the bare union exactly as before (every current call path is
// untouched). Admission stays CRDT-idempotent/commutative/associative for the ADMITTED rows.
//
// ARCHITECTURE CONTRACT (L9 federation = the tensor ∥): this file imports ONLY
//   - L2: jcs (the one canonical JSON, for content-keying) via @red-cup-engineering/computer/eavt
//   - the EAVT section's identity, settle and section; metrologic's sectionSpace
// It imports NO coordinator, NO clock, NO network, NO node:fs. A world here is plain data; whether
// it came off disk (posix-holography) or a socket is the CALLER's concern. Federation is pure.
//
// Lifted from apps/tools/tab/being/doing/federating/scripts/federate.mjs (the on-disk G-Set union
// of <entity>.jsonl logs — "two FARS instances sharing content-addressed entities; a player walks
// from one server to another by their entity file being sent as a message; same SHA-256 hash, same
// identity; no server transfer, just a predication crossing a boundary"). The on-disk plumbing
// (appendFile/mkdir/rowsFor) stays in the app; THIS lifts the algebra: union-by-content-id + re-fold.
//
// Surface
//   admitLog(world, subject, rows[, opts]) -> { world, added, skipped[, inert, rejected] }  gated union
//   federate(worldA, worldB[, opts]) -> world                      the tensor ∥ (alias mergeWorlds)
//   mergeWorlds(...worlds)         -> world                        n-ary fold of federate
//   migrate(from, into, entity)    -> world                        one entity's log crossing a boundary
//   migrateSubjects(world, mapSubject) -> world                   bulk re-key of one world's own subjects
//   provenanceOf(row)              -> { source, kind } | null      the row's claimed witness/source
//   admit(world, subject, rows, recognize[, opts]) -> { world, added, skipped, inert, rejected }  the L10a gate
//   recognizerFrom(test)           -> (source) -> FOUR             normalize a predicate/cone/set to a recognizer
//   subjects(world)                -> string[]                     the subjects a world holds
//   logFor(world, subject)         -> rows[]                       a subject's deduped FOLDED log (admitted only)
//   inertFor(world, subject)       -> rows[]                       a subject's quarantined (⊥) rows (present, not fact)
//   allRows(world)                 -> rows[]                       every row across every log
//   sectionOf(world, subject, opts)-> {affirmed,denied,contradicted}  the edge-only RENDER
//   sectionConeOf(world, subject, opts) -> { section, space, cellFor, stateOfId }  the CONE (Chu space)
//   disagreements(world, opts)     -> [{ subject, predicate, object, evidence, recognizedBy, disputedBy, value }]  the ⊤ cells

import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { eavtRow as assertRow } from "@red-cup-engineering/eavt-services-section/admit-row";
import { identifyContentAddressedRow } from "@red-cup-engineering/eavt-services-section/identify-content-addressed-row";
import { sectionEavtEvidence } from "@red-cup-engineering/eavt-services-section/section-eavt-evidence";
import { settleEavtEvidence } from "@red-cup-engineering/eavt-services-section/settle-eavt-evidence";
import { unique as dedupe } from "@red-cup-engineering/eavt-services-section/deduplicate-rows";
import { sectionSpace } from "@red-cup-engineering/eavt-services-section/independent-evidence-space";
import { isReading } from "@red-cup-engineering/computer-data-engineering-services-section/four";
const rowId = (row) => identifyContentAddressedRow({ row }).identity;
const isReadingInKnowledge = (name) => isReading(name, "knowledge");
 // the four-bilattice values (stable = a held disagreement) + their predicates
import { pointWitnesses } from "@red-cup-engineering/metrologic/chu"; // the cone reads: a point's witness row + its settled charge

// === the world as plain data ================================================================
// A world is a Map<subject, rows[]> OR a plain object {subject: rows[]}. We normalize to a Map so the
// union is a clean key-merge; emptyWorld() seeds one. Normalizing accepts either shape so a caller can
// hand in a JSON-loaded object (e.g. from a wire message) with no ceremony.
export function emptyWorld() {
  return new Map();
}

export function asWorld(world) {
  if (world instanceof Map) return world;
  if (world && typeof world === "object") return new Map(Object.entries(world));
  if (world == null) return new Map();
  throw new TypeError("federate: a world is a Map<subject,rows[]> or a plain {subject:rows[]} object");
}

// The quarantine namespace (L10a): inert (⊥-standing) rows for subject `s` live under the companion
// key `INERT_PREFIX + s`. They are PRESENT (append-only: never dropped) but the read-lens does NOT
// fold them, so an unrecognized peer's converse-spam cannot reach the knowledge join. A companion key
// is itself a row's `e`-keyed log; it just is not surfaced as a real subject.
const INERT_PREFIX = "⊥:"; // "⊥:" — a reserved prefix; a real subject `e` is never this.
const isInertKey = (k) => typeof k === "string" && k.startsWith(INERT_PREFIX);
const inertKeyFor = (subject) => `${INERT_PREFIX}${subject}`;

// subjects(world) — the REAL subjects this world holds a folded log for, sorted for a stable read.
// Quarantine companion keys (⊥:…) are not subjects — they are inert holdings, surfaced via inertFor.
export function subjects(world) {
  return [...asWorld(world).keys()].filter((k) => !isInertKey(k)).sort();
}

// logFor(world, subject) — a subject's FOLDED log (admitted rows only), deduped by content-id (G-Set:
// identical rows are one). This is what the read-lens folds; inert (⊥) rows are NOT here (see inertFor).
export function logFor(world, subject) {
  return dedupe(asWorld(world).get(subject) ?? []);
}

// inertFor(world, subject) — a subject's quarantined (⊥-standing) rows: present in the world but held
// inert, NEVER folded as fact. The L10a holding pen for unverified/unrecognized provenance.
export function inertFor(world, subject) {
  return dedupe(asWorld(world).get(inertKeyFor(subject)) ?? []);
}

// allRows(world) — every row across every log (folded AND inert), deduped globally. The flat trace a
// fold could run over; inert rows are INCLUDED here (append-only: never dropped) — a fold that must
// exclude them reads the folded subject logs instead. Companion keys are walked, just not surfaced.
export function allRows(world) {
  const w = asWorld(world);
  const out = [];
  for (const subject of [...w.keys()].sort()) for (const r of w.get(subject) ?? []) out.push(r);
  return dedupe(out);
}

// === L10a: provenance + recognition — the federation admission gate =========================
// provenanceOf(row) — read a row's CLAIMED witness/source without trusting it yet. A federated row
// carries who-vouched-for-it in one of three conserved places (matching the principal tool's witness
// forms): an explicit `row.source` (a peer id), a `row.signature.by` (a signed-witness mapping to a
// principal), or the witnessed-time form `row.t = { by, at }` (principal.mjs uses `t.by`/`t.at`). A
// bare scalar `t` (the federate test rows' integer t) carries NO source — that is unverified
// provenance (null), which the gate quarantines. Returns { source, kind } or null. This READS the
// claim; RECOGNITION (below) decides whether to trust the claimed source. Verifying a cryptographic
// signature against the source's key is the network membrane's job (Wave 11); here provenance is the
// presence of a readable, source-bearing witness — the gate's first of two checks.
export function provenanceOf(row) {
  if (!row || typeof row !== "object") return null;
  if (typeof row.source === "string" && row.source) return Object.freeze({ source: row.source, kind: "source" });
  const sig = row.signature;
  if (sig && typeof sig === "object" && typeof sig.by === "string" && sig.by) {
    return Object.freeze({ source: sig.by, kind: "signature" });
  }
  const t = row.t;
  if (t && typeof t === "object" && typeof t.by === "string" && t.by) {
    return Object.freeze({ source: t.by, kind: "witnessed-t" });
  }
  return null; // no readable source — unverified provenance
}

// recognizerFrom(test) — normalize the caller's recognition PARAMETER into a uniform recognizer
// `(source) -> FOUR`. The test is the caller's, never a baked policy. Accepted forms:
//   - undefined            → an ungated pass (every source recognized t) — the bare-union back-compat.
//   - a function           → called with the source; its return is coerced to FOUR (a boolean true→t /
//                            false→f; a FOUR member passes through; a whois()-style { value } /
//                            { four } / { settled } cone reading is read for its FOUR; else ⊥).
//   - a Set / array        → membership: a listed source is recognized (t), else not-recognized (⊥).
//   - a Map / plain object  → keyed lookup: value coerced to FOUR; a missing key is ⊥ (no basis).
// A recognizer returns FOUR so honest contest survives: a source the caller holds at ⊤ (recognized AND
// disputed) is still ADMITTED — over-gating honest ⊤ is the failure mode the contract forbids.
export function recognizerFrom(test) {
  if (test == null) return () => "potential"; // ungated: behave as the bare union (back-compat)
  if (typeof test === "function") {
    return (source) => coerceRecognition(test(source));
  }
  if (test instanceof Set) return (source) => (test.has(source) ? "potential" : "absurd");
  if (Array.isArray(test)) {
    const set = new Set(test);
    return (source) => (set.has(source) ? "potential" : "absurd");
  }
  if (test instanceof Map) return (source) => (test.has(source) ? coerceRecognition(test.get(source)) : "absurd");
  if (typeof test === "object") {
    return (source) => (Object.prototype.hasOwnProperty.call(test, source) ? coerceRecognition(test[source]) : "absurd");
  }
  return () => "absurd"; // an unreadable test recognizes nothing
}

// coerceRecognition(v) — read a recognizer's return as a FOUR. A bare boolean is true→t / false→f (the
// common predicate case; asFour itself rejects a boolean, so we map it here). A whois()-style cone
// reading carries its standing in `.value`; a settled flag maps settled→t / unsettled→⊥. A FOUR member
// passes through asFour. Anything else cannot be read as recognition → ⊥ (no basis), never a silent t.
function coerceRecognition(v) {
  if (typeof v === "boolean") return v ? "potential" : "active";
  if (v && typeof v === "object") {
    if ("value" in v) return coerceRecognition(v.value);
    if ("four" in v) return coerceRecognition(v.four);
    if ("settled" in v) return v.settled ? "potential" : "absurd";
    return "absurd";
  }
  if (typeof v === "string" && isReadingInKnowledge(v)) return v;
  return "absurd";
}

// admit(world, subject, rows, recognize, opts?) — the L10a admission gate over one batch. Each row is
// classified by provenance THEN recognition:
//   - PROVENANCE present AND its source recognized t/⊤  → ADMITTED: G-Set-unioned into the folded log
//     (it may settle as fact, including a genuine ⊤ when two RECOGNIZED peers disagree — honest
//     conflict is NOT over-gated).
//   - provenance absent, OR source recognized ⊥ (no basis) / f (denied)  → NOT fact. Two dispositions:
//       opts.onReject !== 'f' (default 'quarantine'): the row enters at ⊥ standing — unioned into the
//         INERT companion log (present, append-only, but the read-lens never folds it).
//       opts.onReject === 'f': the row is REFUSED with a recorded L9b f-fault { condition:'denied',
//         charge, witnesses } (NOT thrown — a fault is a value), carried in `rejected`.
// Returns { world, added, skipped, inert, rejected } — `rejected` is the array of f-faults. `recognize`
// is normalized via recognizerFrom, so a predicate/cone/set/map all work. Idempotent/commutative/
// associative for the ADMITTED set (each disposition is itself a G-Set union deduped by content-id).
export function admit(world, subject, rows, recognize, opts = {}) {
  if (typeof subject !== "string" || !subject) throw new TypeError("admit: subject must be a non-empty string");
  const recognizes = recognizerFrom(recognize);
  const onReject = opts.onReject ?? "quarantine";
  const w = asWorld(world);
  const out = new Map(w);

  const fold = (key, list, isNew) => {
    const existing = out.get(key) ?? [];
    const have = new Set(existing.map(rowId));
    const merged = [...existing];
    let n = 0;
    for (const r of list) {
      const id = rowId(r);
      if (have.has(id)) { isNew.skipped += 1; continue; }
      have.add(id);
      merged.push(r);
      n += 1;
    }
    out.set(key, merged);
    return n;
  };

  const counters = { skipped: 0 };
  const admitted = [];
  const quarantined = [];
  const rejected = [];

  for (const value of rows ?? []) {
    const row = assertRow(value); // shape contract — a malformed row is a programmer fault, the one place we throw
    const prov = provenanceOf(row);
    const standing = prov ? recognizes(prov.source) : "absurd";
    // RECOGNIZED iff the source holds t or a HELD ⊤ (recognized-and-disputed is still recognized — do
    // not over-gate honest contest). ⊥ (no basis) and f (denied) are NOT recognized → not fact.
    const recognized = prov && (standing === "potential" || standing === "stable");
    if (recognized) { admitted.push(row); continue; }
    if (onReject === "f") {
      rejected.push(fault("denied", "active", { disputed: [rowId(row)] }, {
        row: rowId(row),
        source: prov?.source ?? null,
        standing,
        reason: prov
          ? `source '${prov.source}' is not recognized (${standing}); row refused — never folded as fact.`
          : `row carries no readable provenance (no source/signature/witnessed-t); row refused — never folded as fact.`,
      }));
    } else {
      quarantined.push(row);
    }
  }

  const added = fold(subject, admitted, counters);
  const inert = fold(inertKeyFor(subject), quarantined, counters);
  return { world: out, added, skipped: counters.skipped, inert, rejected };
}

// fault(condition, value, witnessIds, detail) — the L9b fault payload as a VALUE (we return it, we do
// not throw it). condition ∈ the spec's set; charge is the FOUR-faced kernel charge (here just the
// FOUR face — the membrane lifts it); witnesses are the row content-ids on each face; detail carries
// the human reason and the source/standing for an audit trail. Frozen so it cannot be mutated downstream.
function fault(condition, value, witnesses, detail) {
  return Object.freeze({
    condition,                 // 'denied' for an unrecognized-source refusal
    charge: (value),     // the FOUR-faced charge (f = denied-with-witnesses)
    witnesses: Object.freeze({ // the disputing row content-ids, kept (evidence-linear: never dropped)
      disputed: Object.freeze([...(witnesses.disputed ?? [])]),
    }),
    ...detail,
  });
}

// === the G-Set union: union one batch into one log ==========================================
// admitLog(world, subject, rows[, opts]) — union `rows` into the world's log for `subject`, deduped by
// content-id. Returns a NEW world (the input is not mutated — federation never overwrites, not even
// in memory) plus how many rows were genuinely new vs. already present. This is the atom every other
// merge is built from; it is exactly tab's `admit`, with the on-disk append replaced by a list union.
//
// L10a: when `opts.recognize` is supplied, admitLog DELEGATES to the gated `admit` (provenance +
// recognition); the return then also carries `inert`/`rejected`. With NO opts.recognize the behavior
// is the bare union exactly as before — every existing call path is untouched.
export function admitLog(world, subject, rows, opts = {}) {
  if (typeof subject !== "string" || !subject) throw new TypeError("admitLog: subject must be a non-empty string");
  if (opts.recognize !== undefined) return admit(world, subject, rows, opts.recognize, opts);
  const w = asWorld(world);
  const out = new Map(w); // structural copy of the key map (logs are replaced, never mutated in place)
  const existing = out.get(subject) ?? [];
  const have = new Set(existing.map(rowId));
  const merged = [...existing];
  let added = 0;
  let skipped = 0;
  for (const value of rows ?? []) {
    const row = assertRow(value); // every federated row is admitted once, as an immutable {e,a,v,t}
    const id = rowId(row);
    if (have.has(id)) { skipped += 1; continue; } // G-Set idempotence: a row already present is dropped
    have.add(id);
    merged.push(row);
    added += 1;
  }
  out.set(subject, merged);
  return { world: out, added, skipped };
}

// === the tensor ∥: federate two worlds ======================================================
// federate(a, b[, opts]) — the binary tensor: union every log of `b` into `a`. Per-LOG union (not
// per-row): a relational row's physical home is wherever it was filed; unioning whole logs preserves
// placement, including dual-filed copies that already live in both anchor logs (tab's note: re-dual-
// filing would double them). Because each log-union is a G-Set union, federate is idempotent,
// commutative, and associative — the three properties the tests prove, and exactly what makes
// coordination unnecessary.
//
// L10a: `opts.recognize` (a recognition predicate/cone/set/map) is the trust gate. Each of B's rows is
// admitted only at the standing its source earned — verified+recognized rows fold as fact; unverified/
// unrecognized rows enter ⊥ (inert) or are refused (opts.onReject:'f'). B's already-quarantined
// companion logs (⊥:…) carry across as inert without re-gating (they are already held inert). With NO
// recognize the behavior is the bare union exactly as before, so every current call path is untouched.
export function federate(a, b, opts = {}) {
  const wb = asWorld(b);
  let world = new Map(asWorld(a));
  for (const key of [...wb.keys()].sort()) {
    const rows = wb.get(key) ?? [];
    if (isInertKey(key)) {
      // an already-quarantined companion log: union it into the SAME companion key, still inert.
      world = unionInto(world, key, rows);
      continue;
    }
    world = admitLog(world, key, rows, opts).world;
  }
  return world;
}

// unionInto(world, key, rows) — a bare content-id G-Set union into one key, no gate. Used to carry a
// peer's already-inert companion log across a federation without re-gating it (it is already held ⊥).
function unionInto(world, key, rows) {
  const w = asWorld(world);
  const out = new Map(w);
  const existing = out.get(key) ?? [];
  const have = new Set(existing.map(rowId));
  const merged = [...existing];
  for (const value of rows ?? []) {
    const row = assertRow(value);
    const id = rowId(row);
    if (have.has(id)) continue;
    have.add(id);
    merged.push(row);
  }
  out.set(key, merged);
  return out;
}

// mergeWorlds(...worlds) — the n-ary fold of federate over an empty world. Order-independent by
// commutativity+associativity, so a swarm of peers can merge in any order and reach the same world.
export function mergeWorlds(...worlds) {
  return worlds.reduce((acc, w) => federate(acc, w), emptyWorld());
}

// === migrate: one entity walking across a boundary ==========================================
// migrate(from, into, entity) — "a player walks from one server to another by their entity file being
// sent as a message." Only that entity's own log crosses; union it into `into`. (The on-disk version
// also restores dual filing of relational rows, because the place anchors are not in the single-log
// batch; that re-filing is the app's job on receipt — here the world is in memory, so the caller folds
// over allRows and the relational rows are already content-addressed wherever they sit.)
export function migrate(from, into, entity) {
  if (typeof entity !== "string" || !entity) throw new TypeError("migrate: entity must be a non-empty string");
  return admitLog(into, entity, logFor(from, entity)).world;
}

/**
 * migrateSubjects — bulk namespace re-key of ONE world's own subjects, distinct from `migrate`'s
 * single-entity crossing between two separate worlds. Every row's subject is rewritten through
 * `mapSubject`; rows that land on the same target subject are G-Set unioned (nothing overwritten),
 * matching federate's own semantics. The case this serves: joining two peers' coordinate systems
 * under a shared prefix once their worlds are already federated into one Map. Lifted from
 * @red-cup-engineering/abrash's federation.mjs (`migrate(world, mapSubject)` there), the one
 * genuinely-unique piece of that module's algebra against this file.
 * @param {World} world
 * @param {(subject: string) => string} mapSubject
 * @returns {World}
 * @throws {TypeError} if mapSubject is not a function
 */
export function migrateSubjects(world, mapSubject) {
  if (typeof mapSubject !== "function") throw new TypeError("migrateSubjects: mapSubject must be a function");
  let out = emptyWorld();
  for (const subject of subjects(world)) {
    const to = mapSubject(subject);
    const rows = logFor(world, subject).map((r) => ({ ...r, e: to }));
    out = admitLog(out, to, rows).world;
  }
  return out;
}

// === the per-observer read-lens =============================================================
// Federation never settles the trace — it only unions it. Reading the current value is a SEPARATE,
// per-observer projection: each observer runs the substrate fold/settle over the union with ITS OWN
// domain knowledge (which predicates are functional, which converse maps to which positive). Two
// observers can read the same federated trace and settle differently; that is by design.

// frontier(world, subject, opts) — the settled section of a subject's log: supersede the functional
// predicates (latest-t read-lens) then fold to the four-bilattice fiber. opts.functional / opts.converse
// / opts.retract pass straight through to substrate.settle. This is "supersede/settle as a per-observer
// read-lens": the trace is untouched; only this projection chooses what the observer sees.
//
// A log is replaced on every admission, never mutated, so a subject's frontier under one lens is a
// function of the log it reads: it is folded once per (log, lens) and shared, frozen, until the
// subject's log changes. A world whose reads touch every subject each step (a game's voxel grid)
// refolds only the subjects that step wrote, not its whole history.
const frontiers = new WeakMap();

function lensKey({ functional, converse, retract }) {
  if (typeof functional === "function" || (retract !== undefined && typeof retract !== "boolean")) return undefined;
  return JSON.stringify([
    functional === undefined ? null : [...functional].sort(),
    converse === undefined ? null : Object.entries(converse).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    retract ?? null,
  ]);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function frontier(world, subject, opts = {}) {
  const settle = () => settleEavtEvidence({
    subject,
    rows: logFor(world, subject),
    functionalAttributes: opts.functional,
    converse: opts.converse,
    retract: opts.retract,
  });
  const log = asWorld(world).get(subject);
  const key = log === undefined ? undefined : lensKey(opts);
  if (key === undefined) return settle();
  let byLens = frontiers.get(log);
  if (byLens === undefined) frontiers.set(log, byLens = new Map());
  if (!byLens.has(key)) byLens.set(key, deepFreeze(settle()));
  return byLens.get(key);
}

// sectionOf(world, subject, opts) — the finite shadow {affirmed, denied, contradicted} of the frontier.
// This is the edge-only RENDER (the law's word): it DROPS which witness charged which face. Kept
// verbatim for back-compat; the cone sibling below carries the witnesses as coordinates.
export function sectionOf(world, subject, opts = {}) {
  return sectionEavtEvidence({ folded: frontier(world, subject, opts) });
}

// sectionConeOf(world, subject, opts) — the CONE sibling of sectionOf (mirrors principal.whois().space).
// A federated world Map<subject,rows[]> is "the same shape" the Chu space names (chu.mjs:9 — EAVT memory
// Entity×Attribute→charge). For ONE subject the cone is sectionSpace(frontier(...), logFor(...)): the
// POINTS are the subject's folded cells keyed canonicalJson([predicate,object]); the STATES are the witnessing
// coordinate stateOf(row) (the federated test rows carry an integer `t`, so a "state" is the witness
// time-stamp, not a party — still a valid coordinate); the VALUE at (cell,state) is the FOUR face that
// state witnesses (t positive, f converse, ⊤ both, ⊥ absent). A ⊤ point is a disagreement; its row of
// states is the two sides. Returns the section (edge render) ALONGSIDE the cone — pass .space on; do not
// re-fold downstream. opts pass straight through to frontier (the per-observer read-lens) and sectionSpace.
export function sectionConeOf(world, subject, opts = {}) {
  const folded = frontier(world, subject, opts);
  const { space, cellFor, stateOfId } = sectionSpace(folded, logFor(world, subject), opts);
  return Object.freeze({ section: sectionEavtEvidence({ folded }), space, cellFor, stateOfId });
}

// disagreements(world, opts) — every contradiction (⊤ cell) across the federated world: a subject told
// both a predicate AND its converse. The proof that conflicting facts "settle to ⊤ with BOTH witnesses".
//
// READ, don't re-derive: build the recognition CONE once per subject (sectionSpace), then a ⊤ point is
// settleRow(space,point)==="stable" — the cone's settled face, NOT a hand-rolled `cell.value.pos &&
// cell.value.neg` test. The two witness SIDES are a row read (chuRow): the states whose face is t/⊤ are
// the recognizers, the states whose face is f/⊤ are the disputers. The cell's {predicate,object} and the
// raw evidence carrier are read off the folded cell via cellFor(point). KEEP the existing entry shape
// {subject,predicate,object,evidence} and ADD recognizedBy/disputedBy + reading:"stable".
export function disagreements(world, opts = {}) {
  const out = [];
  for (const subject of subjects(world)) {
    const { space, cellFor } = sectionConeOf(world, subject, opts);
    for (const point of space.points) {
      const witnesses = pointWitnesses(space, point);
      if (witnesses.settled !== "stable") continue; // a ⊤ point IS a held disagreement
      const { predicate, object, value } = cellFor(point);
      out.push({
        subject,
        predicate,
        object,
        evidence: value.evidence,         // [ [positive row-ids], [negative row-ids] ] — both kept
        recognizedBy: witnesses.for,      // the witness-states on the positive face (cone coordinates)
        disputedBy: witnesses.against,    // the witness-states on the negative face
        reading: "stable",                // the cone's settled face — a HELD ⊤, not a re-derived flag
      });
    }
  }
  return out;
}

// contentKey(world) — the world's whole content as one canonical string (jcs over the deduped logs).
// Two worlds with equal content have equal key; used by tests to assert idempotence/commutativity/
// associativity by VALUE rather than by reference, since each merge returns a fresh Map.
export function contentKey(world) {
  const w = asWorld(world);
  // ALL keys (real subjects AND inert ⊥: companions) so CRDT-by-content equality covers the whole held
  // world — two gated merges that reach the same admitted-and-quarantined state have the same key.
  const keys = [...w.keys()].sort();
  const logs = keys.map((k) => [k, dedupe(w.get(k) ?? []).map(rowId).sort()]);
  return canonicalJson(logs);
}

export default federate;
