// substrate — the GENERAL eavt trace algebra: the read->fold->settle spine, the per-predicate
// FUNCTIONAL read-lens, the general relational graph read, the settled-section projection, and the
// reified-row identity helpers. This is the OS substrate that tab/ruinfold/aletheon/swarm hand-roll;
// computer provides it once, drawn from apps/tools/tab/scripts/_substrate.mjs and being.mjs.
//
// It composes the canonical pieces and re-derives NOTHING:
//   - identity + row contract + G-Set dedup: @red-cup-engineering/computer/typed-resource-catalog/eavt (rowId, assertRow, dedupe, jcs)
//   - the evidence fold:                      SignCell cells, merged per (predicate, object)
// State is an append-only trace of {e,a,v,t} rows; the current value is the FOLD of the trace. The
// per-predicate "functional" lens (supersede) is a READ-time latest-t projection — NEVER a
// destructive write, NEVER overwrite, NEVER last-write-wins-that-discards-history. The trace keeps
// every witness; supersede only chooses which rows a given read PROJECTS.
//
// Everything here is pure (no node:fs). The bytes-on-disk side stays posix-holography's
// eavt-append / eavt-read; an app pairs those with this fold. Domain knowledge — WHICH predicates are
// functional, WHICH are relational, WHICH relation locationOf reads — is a PARAMETER, never baked in:
// the game-specific FUNCTIONAL/RELATIONAL sets, located-in/contains specializations, the
// (root,...,t,dirty) mutation contract, ticking and world-event projection STAY in the app.

import { rowId, assertRow, dedupe } from "@red-cup-engineering/computer/typed-resource-catalog/eavt";
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { cell, merge, readingOfSides, told } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";
import { chuSpace } from "@red-cup-engineering/computer-code-engineering-services-section/signchain/chu";

// Re-export the canonical row algebra so a substrate consumer gets identity + contract + dedup + the
// one canonical JSON from a single import (no second copy, no drift).
export { rowId, assertRow, dedupe, canonicalJson };

// === reified-row identity ===================================================================
// A reified row is a row ABOUT a base row: its subject `e` is the base row's content-id, prefixed so
// the fold can tell state rows from attributions. The prefix is load-bearing: supersede and fold skip
// any row whose `e` starts with it (reified rows are evidence-about-rows, not subject state).
export const REIFIED_PREFIX = "row:";
// reify(base) -> the content-address of a base row, prefixed. (16-hex slice keeps it legible; identity
// is still the full content of the base row through rowId/jcs.)
export const reify = (base) => `${REIFIED_PREFIX}${rowId(base).slice(0, 16)}`;
// isReified(e) -> is this entity-id an attribution about a row (not a subject)?
export const isReified = (e) => typeof e === "string" && e.startsWith(REIFIED_PREFIX);

// === independent predication evidence ==========================================================
// A Fregean predication fixes ONE oriented (subject,predicate,object) point. Evidence for and
// evidence against that same point are independent coordinates; neither relational converse nor
// subject/object reversal means denial. This additive witness convention leaves the legacy
// `opts.converse` adapter intact for existing consumers while giving new callers the direct
// Bool×Bool evidence path proved by Obsmetrologia.Language.Predicating.FregeanFourChu.
export const INDEPENDENT_EVIDENCE_WITNESS_KIND = "predication.independent-evidence";

export function independentEvidenceSide(row) {
  if (row?.t?.kind !== INDEPENDENT_EVIDENCE_WITNESS_KIND) return null;
  if (row.t.version !== 1) throw new TypeError("independent evidence witness must be version 1");
  if (row.t.side !== "positive" && row.t.side !== "negative") {
    throw new TypeError("independent evidence witness side must be positive or negative");
  }
  return row.t.side;
}

// === the per-predicate FUNCTIONAL read-lens =================================================
// A predicate is "functional" when it is single-valued over time: at settle, only the latest-t row for
// that predicate on a subject survives the projection. WHICH predicates are functional is the caller's
// domain knowledge — passed as a `functional` test. We support two shapes so an app can hand its set in
// directly: a Set of exact names, or a predicate `(a) => boolean`. A family with a dynamic tail
// (need:hunger, attr:str) is the caller's to fold into its predicate via a prefix check.
const asFunctional = (functional) => {
  if (typeof functional === "function") return functional;
  if (functional instanceof Set) return (a) => functional.has(a);
  return () => false; // no functional predicates => supersede is identity (mod reified-row drop)
};

// supersede(rows, functional?) — keep, for each functional predicate `a` on these rows, only the
// max-t row; non-functional rows all survive; reified rows are dropped (they are not subject state).
// This is the latest-t PROJECTION, applied at read. It mutates NOTHING on disk; the trace is intact.
export function supersede(rows, functional) {
  const fn = asFunctional(functional);
  const latest = new Map(); // a -> max t seen
  for (const r of rows) {
    if (isReified(r.e)) continue;
    if (!fn(r.a)) continue;
    const cur = latest.get(r.a);
    if (cur === undefined || r.t > cur) latest.set(r.a, r.t);
  }
  return rows.filter((r) => isReified(r.e) || !fn(r.a) || r.t === latest.get(r.a));
}

// === the general relational graph read ======================================================
// relate(rows, predicate, object) — the subjects `e` of rows where (e, predicate, object): "who stands
// in `predicate` to `object`?". This is the GENERAL relational read; an app specializes it
// (containedBy = relate(rows, "located-in", place)). Reified rows are excluded — a relation holds
// between subjects, not about rows. Deduped, sorted for a stable read.
export function relate(rows, predicate, object) {
  const out = new Set();
  for (const r of rows) {
    if (isReified(r.e)) continue;
    if (r.a === predicate && r.v === object) out.add(r.e);
  }
  return [...out].sort();
}

// relateFrom(rows, subject, predicate) — the objects `v` of rows where (subject, predicate, v): "what
// does `subject` stand in `predicate` to?". The inverse direction of relate. An app specializes it
// (locationOf = the latest functional relateFrom(rows, subject, "located-in")). NO latest-t projection
// here — that is supersede's job; relateFrom returns every object asserted (deduped, in trace order).
export function relateFrom(rows, subject, predicate) {
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (isReified(r.e)) continue;
    if (r.e === subject && r.a === predicate) {
      const k = canonicalJson(r.v);
      if (!seen.has(k)) { seen.add(k); out.push(r.v); }
    }
  }
  return out;
}

// === the read->fold->settle spine ===========================================================
// fold(subject, rows, opts?) — fold a subject's conformant {e,a,v,t} trace into its settled section: a
// fiber of cells, one per distinct (predicate, object), each a SignCell cell whose evidence accumulates
// the content-ids
// of the rows that witness each face — nothing is dropped, so a cell told both its predicate AND its
// converse settles to ⊤ (a HELD value, not an error).
//
// Legacy negative-evidence adapter: opts.converse maps an OPPOSING predicate to the positive predicate
// it denies (e.g. {"shut": "open"}). The historical option is preserved for consumers, but it must not
// be used for a relational converse such as contains/located-in: reversing relation orientation is not
// evidence against either oriented claim. New code should use foldIndependentEvidence below.
//
// opts.retract: a row {e:subject, a, v:null, t} is a retraction tombstone — it stops every EARLIER
// assertion of `a` on this subject from contributing (honest append-only undo; the null row IS the new
// positing event). On by default (pass {retract:false} to fold raw).
//
// Returns { entity, fiber: [{ predicate, object, value:{pos,neg,evidence:[posIds,negIds]} }] }, deeply
// frozen, fiber sorted by (predicate, object). A pure projection — the trace stays the source of truth.
export function fold(subject, rows, opts = {}) {
  if (typeof subject !== "string" || !subject) throw new TypeError("fold: subject must be a non-empty string");
  if (!Array.isArray(rows)) throw new TypeError("fold: rows must be an {e,a,v,t} array");
  for (const r of rows) assertRow(r);

  // converse: declared in-trace via (p has-converse q), merged with opts.converse {converse: positive}.
  const converse = { ...(opts.converse ?? {}) };
  for (const r of rows) if (r.a === "has-converse") converse[r.v] = r.e;

  // retraction tombstones: latest null-row time per predicate on this subject.
  const retractedAfter = new Map();
  if (opts.retract !== false) {
    for (const r of rows) {
      if (r.e === subject && r.v === null) {
        const cur = retractedAfter.get(r.a);
        if (cur === undefined || r.t > cur) retractedAfter.set(r.a, r.t);
      }
    }
  }

  const cells = new Map();
  for (const [index, claim] of (opts.claims ?? []).entries()) {
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) throw new TypeError(`fold: claims[${index}] must be an object`);
    if (claim.subject !== subject) throw new TypeError(`fold: claims[${index}].subject must equal the folded subject`);
    if (typeof claim.predicate !== "string" || claim.predicate === "") throw new TypeError(`fold: claims[${index}].predicate must be a non-empty string`);
    const key = canonicalJson([claim.predicate, claim.object]);
    cells.set(key, cell(subject, claim.predicate, claim.object));
  }
  for (const r of rows) {
    if (r.e !== subject || r.a === "has-converse") continue;
    if (isReified(r.e)) continue;
    if (r.v === null) continue; // a retraction row carries no positive evidence
    if (retractedAfter.has(r.a) && r.t < retractedAfter.get(r.a)) continue; // tombstoned
    const id = rowId(r);
    const explicitSide = opts.evidenceSideOf?.(r) ?? null;
    if (explicitSide !== null && explicitSide !== "positive" && explicitSide !== "negative") {
      throw new TypeError("fold: evidenceSideOf must return positive, negative, or null");
    }
    const base = explicitSide === null ? converse[r.a] : undefined;
    const predicate = base ?? r.a;
    // An explicit side keeps the exact oriented claim. Only the legacy adapter remaps an opposing
    // predicate onto the negative face of its configured positive predicate.
    const negative = explicitSide === "negative" || (explicitSide === null && base !== undefined);
    const telling = cell(subject, predicate, r.v, negative ? { against: [id] } : { for: [id] });
    const key = canonicalJson([predicate, r.v]);
    const prior = cells.get(key);
    cells.set(key, prior === undefined ? telling : merge(prior, telling));
  }

  const fiber = [...cells.values()]
    .sort((a, b) => canonicalJson([a.predicate, a.object]).localeCompare(canonicalJson([b.predicate, b.object])))
    .map((at) => ({
      predicate: at.predicate,
      object: at.object,
      value: {
        pos: told(at)[0] ? 1 : 0,
        neg: told(at)[1] ? 1 : 0,
        // the witnessing row ids (the fiber's published shape)
        evidence: [at.for, at.against],
      },
    }));

  return deepFreeze({ entity: subject, fiber });
}

// settle(subject, rows, opts?) — the spine in one call: supersede the functional predicates (the
// latest-t read-lens), then fold to the settled section. opts.functional is the functional test
// (Set or predicate); the rest of opts passes through to fold (converse, retract). The full
// read->fold->settle an app drives off disk: read its rows with eavt-read, then settle them here.
export function settle(subject, rows, opts = {}) {
  return fold(subject, supersede(rows, opts.functional), opts);
}

// foldIndependentEvidence — the contract-native fold for one set of oriented predications. Claims
// seed the points, so a point with no evidence remains present at ⊥. Every evidence row is still exact
// EAVT; its transaction/witness names which independent coordinate it observed and who observed it.
// `opts.converse` is refused here because opposition/converse cannot define the negative coordinate.
export function foldIndependentEvidence(subject, claims, rows, opts = {}) {
  if (!Array.isArray(claims)) throw new TypeError("foldIndependentEvidence: claims must be an array");
  if (Object.hasOwn(opts, "converse")) throw new TypeError("foldIndependentEvidence: converse is not denial; use independent negative witnesses");
  return fold(subject, rows, { ...opts, claims, evidenceSideOf: independentEvidenceSide });
}

// === the settled-section projection =========================================================
// section(folded) — project a folded section to {affirmed, denied, contradicted}: the finite shadow
// the predicate algebra reads. affirmed = t cells (pos only), denied = f cells (neg only, a belief
// STATE not a retraction), contradicted = ⊤ cells (told both). ⊥ cells carry no evidence and are
// omitted. Each bucket is a list of {predicate, object}. Takes the OUTPUT of fold/settle.
export function section(folded) {
  const out = { affirmed: [], denied: [], contradicted: [] };
  for (const c of folded.fiber) {
    const { pos, neg } = c.value;
    const cell = { predicate: c.predicate, object: c.object };
    if (pos && neg) out.contradicted.push(cell);
    else if (pos) out.affirmed.push(cell);
    else if (neg) out.denied.push(cell);
  }
  return out;
}

// === the settled section AS A CHU SPACE (the cone section() flattens) ========================
// sectionSpace(folded, rows, opts?) — lift a folded fiber-algebra into an explicit Chu space over FOUR
// (SignChain's chu): the rich sibling of
// section(). Where section() projects the fiber to a flat
// {affirmed,denied,contradicted} and DROPS which witness stands where, sectionSpace() keeps the witness
// as a first-class COORDINATE — the POINTS are the folded cells (keyed canonicalJson([predicate,object])), the
// STATES are the witnessing coordinate stateOf(row) (e.g. the party in t.by), and the reading at
// (cell, state) is the FOUR face that state witnesses: potential if it witnessed the positive face,
// active the converse, stable both, absurd (open-world absent) neither. A consumer then reads "who
// recognized claim X" as a row of the space (SignChain chu's row/extension/settleRow) instead of
// rebuilding a witness index — the evidence row-ids are resolved to states ONCE, here.
//   opts.stateOf(row) -> the column coordinate a row witnesses (default r.t?.by ?? r.t).
//   opts.predicate     -> keep only cells on this predicate (optional filter).
//   opts.absent        -> the reading a non-witnessing (cell,state) reads (default
//                         "absurd", the open-world EAVT reading).
// Returns { space, cellFor(pointKey) -> {predicate,object,value}, stateOfId: Map<rowId,state> }. The
// returned stateOfId is the one id→state resolution, reusable so no caller rebuilds it.
export function sectionSpace(folded, rows = [], opts = {}) {
  const stateOf = opts.stateOf ?? ((r) => (r && r.t && typeof r.t === "object" ? r.t.by : r?.t));
  const absent = opts.absent ?? "absurd";
  const stateOfId = new Map();
  for (const r of rows) {
    const s = stateOf(r);
    if (s != null) stateOfId.set(rowId(r), String(s));
  }
  const partiesOf = (ids) => {
    const out = new Set();
    for (const id of ids) { const s = stateOfId.get(id); if (s != null) out.add(s); }
    return out;
  };

  const cells = new Map();        // pointKey -> { predicate, object, value }
  const posParties = new Map();   // pointKey -> Set(state)
  const negParties = new Map();   // pointKey -> Set(state)
  const stateSet = new Set();
  for (const c of folded.fiber) {
    if (opts.predicate !== undefined && c.predicate !== opts.predicate) continue;
    const key = canonicalJson([c.predicate, c.object]);
    cells.set(key, { predicate: c.predicate, object: c.object, value: c.value });
    const [posIds, negIds] = c.value.evidence;
    const pos = partiesOf(posIds), neg = partiesOf(negIds);
    posParties.set(key, pos); negParties.set(key, neg);
    for (const s of pos) stateSet.add(s);
    for (const s of neg) stateSet.add(s);
  }
  const points = [...cells.keys()].sort();
  const states = [...stateSet].sort();
  const readingAt = (point, state) => {
    const pos = posParties.get(point)?.has(state) ?? false;
    const neg = negParties.get(point)?.has(state) ?? false;
    return !pos && !neg ? absent : readingOfSides("knowledge", pos, neg);
  };
  return {
    space: chuSpace(points, states, readingAt, { absent }),
    cellFor: (key) => cells.get(key),
    stateOfId,
  };
}

function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const c of Object.values(v)) deepFreeze(c);
    Object.freeze(v);
  }
  return v;
}
