// process — the aperiodic PROCESS MODEL: a process is a working-system that settles to a FIXED
// POINT in aperiodic time. There is NO clock. Settling is Knaster-Tarski: iterate the
// read->fold->settle spine, monotonically accumulating judgments under the bilattice knowledge order,
// until the settled section stops moving. A process value is a CHARGE-valued section, and its
// composite readiness is the truth meet of its judgments (Obsmetrologia meetTList): their
// conjunction, ready exactly at ⊤t.
//
// ARCHITECTURE CONTRACT (L9 process): a process is a concurrent STRATEGY composing read->fold->settle
// tiles by parallel-composition-plus-hiding. Governance decisions are FOUR-valued; the composite is the
// conjunction, so a contradiction beside a denial reads as the denial, and each judgment is kept as
// its witness. This module is PURE: it imports ONLY the substrate
// (settle/section) and the truth meet (the data layer's four). It bakes in NO
// domain: WHICH judgments a process raises (capability, cost, tool-admission, …) is the caller's,
// passed as a `judge` strategy. Lifted from apps/tools/swarm/src/{readiness,dispatch,status}.mjs —
// the FOLD structure, not swarm's specific ten checks (those stay in swarm for the rewire).
//
// A PROCESS is a value:
//   { id, rows, judge?, after?, office?, principal?, accountable?, allocation? }
// where `rows` is the process's append-only {e,a,v,t} EAVT trace (its working state) and `judge` is
// the pure strategy (proc, world) -> [{ name, value:FOUR, reason?, path? }] raising this process's
// judgments. Everything else is a typed face read off the trace.

import { sectionEavtEvidence, settleEavtEvidence } from "@red-cup-engineering/eavt-services-section";
import { sectionSpace } from "@red-cup-engineering/metrologic/articulation/predicating/positing/independent-evidence";
import { evidence } from "@red-cup-engineering/signcell/cell";
import { pointWitnesses } from "@red-cup-engineering/metrologic/chu";
import { readingAs, truthMeetAll, isTruthTop } from "@red-cup-engineering/computer-data-engineering-services-section/four";

// facesOf(space, point) — the readiness cone read, mirroring principal.mjs's facesOf: the witnessing
// states of a Work-item/check cell, split by the FOUR face they charge, plus the cell's settled
// (knowledge-join) reading. A process row often carries `t` as a bare string stamp (no `.by`), so an
// asserted cell whose witness is absent reads ⊥ — correct open-world: pinned from neither side. This
// ENRICHES the readiness reading off the cone; it never replaces the section's affirmed/denied buckets.
const facesOf = (space, point) => {
  const witnesses = pointWitnesses(space, point);
  return { settled: witnesses.settled, assertedBy: witnesses.for, deniedBy: witnesses.against };
};

// the process's subject term: its id is the EAVT entity its trace folds on.
const subjectOf = (proc) => (typeof proc === "string" ? proc : proc?.id);

// the functional-predicate test the process trace folds under: the caller's domain knowledge,
// defaulting to none (every predicate multi-valued — supersede is identity mod reified rows). A
// process that names single-valued predicates (a status, an assignee) passes them in opts.functional.
const functionalOf = (proc, opts) => opts.functional ?? proc?.functional ?? (() => false);

// === the settled SECTION of a process =======================================================
// foldProcess(proc, opts?) — fold the process's own EAVT trace to its settled section: the
// CHARGE-valued fiber (substrate.settle), then the {affirmed, denied, contradicted} projection
// (substrate.section). This is one read->fold->settle tile; settleProcess iterates it to a fixed
// point. A pure projection — the trace stays the source of truth.
export function foldProcess(proc, opts = {}) {
  const subject = subjectOf(proc);
  if (typeof subject !== "string" || !subject) throw new TypeError("foldProcess: process must have a string id");
  const rows = proc?.rows ?? opts.rows ?? [];
  const folded = settleEavtEvidence({
    subject,
    rows,
    functionalAttributes: functionalOf(proc, opts),
    converse: opts.converse,
    retract: opts.retract,
  });
  // build the readiness CONE ONCE here — the Chu space section() flattens. POINTS = the process's
  // folded cells (Work items / checks the trace asserts), STATES = the witnessing coordinate, value =
  // the FOUR face that witness charges. Callers (readProcessValue, the void reading) read this cone
  // instead of re-sectioning. {folded, section} stay byte-identical; `space` is the additive carry.
  return { folded, section: sectionEavtEvidence({ folded }), space: sectionSpace(folded, rows).space };
}

// === settleProcess — Knaster-Tarski to a FIXED POINT, NO clock ===============================
// settleProcess(world, id, opts?) — settle ONE process to its least fixed point. The process's own
// judgments (its `judge` strategy, given the world) may derive NEW rows; those rows fold back into
// the section; the section may raise/retract judgments; we iterate until the section is stable. This
// is Knaster-Tarski over the bilattice knowledge order: each step is MONOTONE (rows only accumulate,
// evidence is never dropped), so the iteration converges on a finite trace. Aperiodic: there is no
// tick — the fixed point is reached when nothing more can be derived, however many folds that takes.
//
// `opts.derive(proc, sectioned, world)` is the optional caller strategy mapping the current section
// to additional rows to admit into the trace before the next fold (a process's working step). With
// no derive, settleProcess is a single fold (the trace is already its own fixed point).
//
// THE LAW (OP6 — termination of settle): a settle that does NOT reach quiescence within `maxFolds`
// MUST NOT silently return the last board — that is a hidden timeout pretending a fixed point it never
// reached. On hitting the cap it RETURNS a held RESIDUE: a ⊥-faced / 'resource-exhausted' cone
// (the EAGAIN/precipitate analogue) carrying the unsettled cells and their witnesses, surfaced via the
// same `kind:"process.settled"` shape so a caller branches on `face` / `condition`. A genuinely
// quiesced settle (the section stopped moving, or nothing more was derivable) returns its t-faced
// settled cone exactly as before. The loop stays monotone and clock-free — no wall-clock tick drives it.
//
// Returns the settled process: the original proc with its (possibly extended) rows, its folded
// section, its FOUR-valued readiness value (the truth meet of its judgments), and the per-judgment witnesses. On saturation the same shape carries the residue (see above).
export function settleProcess(world, id, opts = {}) {
  const proc = resolveProc(world, id, opts);
  const derive = opts.derive ?? proc?.derive ?? null;
  const maxFolds = opts.maxFolds ?? 1024; // configurable cap; guards a non-monotone derive (the law is monotone).

  let rows = proc?.rows ?? [];
  let prevKey = null;
  let sectioned = { affirmed: [], denied: [], contradicted: [] };
  let current = { ...proc, rows };
  let folded;
  let quiesced = false;                      // did the iteration reach a FIXED POINT, or hit the cap?

  for (let step = 0; step < maxFolds; step++) {
    const out = foldProcess(current, opts);
    folded = out.folded;
    sectioned = out.section;
    const key = sectionKey(sectioned);
    if (key === prevKey) { quiesced = true; break; }   // FIXED POINT: the section stopped moving.
    prevKey = key;
    if (!derive) { quiesced = true; break; }            // no working step => the trace is its own fixed point.
    const next = derive(current, sectioned, world) ?? [];
    if (!next.length) { quiesced = true; break; }       // nothing more derivable => fixed point.
    rows = [...rows, ...next];                 // MONOTONE: rows only accumulate (append-only).
    current = { ...current, rows };
  }

  // OP6: the loop exhausted `maxFolds` with the section STILL MOVING — we did NOT reach quiescence.
  // Surface a held residue cone, NEVER the silent last board. The residue is ⊥-faced (would-block /
  // EAGAIN), condition 'resource-exhausted' (the fold budget ran out), carrying the unsettled cells
  // and their witnesses off the last fold's readiness cone — the evidence a silent return would drop.
  if (!quiesced) {
    return saturationResidue(world, id, opts, { proc, current, rows, folded, sectioned, maxFolds });
  }

  const judgments = readJudgments(current, world, opts);
  const value = truthMeetAll(judgments.map((j) => j.value));
  return Object.freeze({
    kind: "process.settled",
    id: subjectOf(proc),
    quiesced: true,         // a genuine fixed point was reached — this is a settled, not a residue, cone.
    face: readingAs("knowledge", value),    // the cone's read-FACE: t ready, f denied, ⊥ unsettled, ⊤ contradicted-held.
    process: { ...current },
    rows,
    folded,
    section: sectioned,
    judgments,
    value,                  // the FOUR-valued composite: t ready, f denied, ⊥ unsettled, ⊤ contradicted.
    ready: isTruthTop(value),
    contradicted: readingAs("knowledge", value) === "stable",
    unsettled: readingAs("knowledge", value) === "absurd",
    denied: readingAs("knowledge", value) === "active",
  });
}

// saturationResidue — the OP6 held residue when settle exhausts `maxFolds` without quiescing. It is a
// ⊥-faced cone (the unsettled/would-block face) with an L9b fault payload { condition, charge, witnesses }
// keyed to 'resource-exhausted'. The unsettled cells are the LAST fold's section cells (everything the
// settle is still actively moving), and their witnesses are read off the readiness cone (facesOf,
// mirroring readProcessValue) so the residue carries WHO stands on each unsettled cell — evidence is
// linear, the silent last board would drop it. The process re-enters a later settle pass (reap = read
// this residue and re-drive); nothing is discarded. NO wall-clock enters this — saturation is a fold-
// count fact, not a time fact.
function saturationResidue(world, id, opts, ctx) {
  const { proc, current, rows, folded, sectioned, maxFolds } = ctx;
  // the readiness CONE off the last fold — the witness coordinate the flat section drops.
  const space = sectionSpace(folded ?? { fiber: [] }, rows ?? []).space;
  const claims = Object.freeze(space.points.map((point) => Object.freeze({ point, ...facesOf(space, point) })));
  // the unsettled cells: the section the settle was STILL MOVING — every cell of the last board, since
  // none of it had stabilized. Carry all three buckets so the residue is honest about the held (⊤)
  // contradictions too; nothing is collapsed into a winner.
  const unsettledCells = Object.freeze([
    ...sectioned.affirmed.map((c) => Object.freeze({ ...c, face: "potential" })),
    ...sectioned.denied.map((c) => Object.freeze({ ...c, face: "active" })),
    ...sectioned.contradicted.map((c) => Object.freeze({ ...c, face: "stable" })),
  ]);
  // the L9b fault payload: ⊥ face (no fixed point STANDS — open from the saturation side), condition
  // 'resource-exhausted'. Its evidence is empty (⊥, nothing told); witnesses are the states standing on
  // the unsettled cells (both faces conserved), read off the cone.
  const witnesses = Object.freeze([...space.states]);
  const fault = Object.freeze({ condition: "resource-exhausted", evidence: evidence(), witnesses });
  return Object.freeze({
    kind: "process.settled",
    id: subjectOf(proc),
    quiesced: false,        // OP6: the cap was hit; this is a RESIDUE, not a reached fixed point.
    face: "absurd",         // the cone's read-FACE is ⊥ — would-block / EAGAIN, the residue/precipitate face.
    condition: "resource-exhausted",
    fault,                  // the L9b fault payload { condition, evidence, witnesses } — return it, never throw.
    maxFolds,               // the cap that was hit — the budget; a caller may re-drive with a larger one.
    process: { ...current },
    rows,                   // the (extended) trace — append-only; re-enters a later settle pass (reap).
    folded,
    section: sectioned,
    residue: Object.freeze({ cells: unsettledCells, space, claims }), // the unsettled cells + their witnesses
    space,                  // the readiness CONE — the residue's witness coordinate (don't re-section)
    cone: space,            // a name mirror for callers that read the cone by that word
    claims,                 // per-cell witness reading off the cone (assertedBy/deniedBy/settled)
    judgments: [],          // no composite judgment rose — the settle never quiesced to read one
    value: "absurd",        // the FOUR-valued composite is ⊥: unsettled (held), NOT a silent t/last board.
    ready: false,
    contradicted: false,
    unsettled: true,        // composite ⊥ — the held residue face
    denied: false,
  });
}

// resolveProc — a process id may be a string (look it up in world.processes) or the process itself.
function resolveProc(world, id, opts) {
  if (id && typeof id === "object") return id;
  const fromOpts = opts.process ?? opts.proc;
  if (fromOpts && subjectOf(fromOpts) === id) return fromOpts;
  const registry = world?.processes;
  if (registry) {
    if (typeof registry.get === "function") { const p = registry.get(id); if (p) return p; }
    else if (registry[id]) return registry[id];
  }
  return { id };
}

// readJudgments — run the process's pure judgment strategy against the world. Each judgment is a
// FOUR-valued verdict (NOT a boolean) with a reason and an optional witness path. With no strategy a
// process raises exactly one judgment from its own settled section (contradicted ⊤ beats denied f
// beats affirmed-only t), so even a strategy-free process is FOUR-valued from its trace alone.
function readJudgments(proc, world, opts) {
  const judge = opts.judge ?? proc?.judge ?? null;
  if (judge) {
    return judge(proc, world).map((j) => ({
      name: String(j.name ?? "judgment"),
      value: readingAs("knowledge", j.value),
      reason: j.reason ?? "",
      path: j.path ?? "",
    }));
  }
  return [sectionJudgment(proc, opts)];
}

// the strategy-free judgment: read the process's own section. A contradicted cell makes the process
// ⊤ (held), a denied-only section makes it f, otherwise t. THE LAW: contradiction is a held value.
function sectionJudgment(proc, opts) {
  const { section: s } = foldProcess(proc, opts);
  if (s.contradicted.length) return { name: "section", value: "stable", reason: `${s.contradicted.length} contradicted cell(s) held`, path: "" };
  if (!s.affirmed.length && s.denied.length) return { name: "section", value: "active", reason: "section denied", path: "" };
  if (!s.affirmed.length && !s.denied.length) return { name: "section", value: "absurd", reason: "section empty (unsettled)", path: "" };
  return { name: "section", value: "potential", reason: "section affirmed", path: "" };
}

// a stable key over a settled section so the fixed-point loop can detect "the section stopped moving".
function sectionKey(s) {
  const cells = (bucket, list) => list.map((c) => `${bucket}:${stableCell(c)}`).sort();
  return JSON.stringify([
    ...cells("a", s.affirmed),
    ...cells("d", s.denied),
    ...cells("c", s.contradicted),
  ]);
}

function stableCell(c) {
  return `${String(c.predicate)}=${typeof c.object === "object" ? JSON.stringify(c.object) : String(c.object)}`;
}

// === readProcessValue — the process's FOUR-valued value, projected ============================
// readProcessValue(proc) -> { affirmations, denials, contradicted, unsettled }. Reads a SETTLED
// process (settleProcess's output) OR settles a raw process first. affirmations/denials/contradicted
// are the section's three buckets (THE LAW's CHARGE-valued cells); `unsettled` is the boolean ⊥
// reading of the composite (no judgment has risen to settle the process). Contradicted is HELD —
// surfaced as its own bucket, NEVER folded into denials.
export function readProcessValue(proc, opts = {}) {
  const settled = proc?.kind === "process.settled" ? proc : settleProcess(opts.world ?? null, proc, opts);
  const s = settled.section;
  // the readiness CONE — built ONCE off the settled fold (the Chu space the {affirmations,denials,
  // contradicted} triple is the edge RENDER of). This is the additive CARRY: the buckets below are the
  // flat render that keeps the 12 tests byte-identical; `space` lets a downstream tile read WHICH
  // witness/check stands on each cell (chuRow/settleRow), the evidence the triple drops. We do NOT
  // recompute the buckets off the cone — they stay the section's three buckets exactly as before.
  const space = sectionSpace(
    settled.folded ?? { fiber: [] },
    settled.rows ?? settled.process?.rows ?? [],
  ).space;
  // per-cell witness reading off the cone (facesOf, mirroring principal): WHICH witness/check stands
  // on each Work item and the cell's settled (knowledge-join) face. This is the evidence the flat
  // triple drops — it ENRICHES, it does not replace the buckets (which stay the section's, byte-exact).
  const claims = Object.freeze(space.points.map((point) => Object.freeze({ point, ...facesOf(space, point) })));
  return Object.freeze({
    affirmations: s.affirmed,
    denials: s.denied,
    contradicted: s.contradicted,         // ⊤ held, never collapsed into denials
    unsettled: settled.unsettled,         // composite ⊥ — nothing has risen to settle it
    value: settled.value,
    ready: settled.ready,
    space,                                // the readiness CONE — pass it on; don't re-section downstream
    cone: space,                          // a name mirror for callers that read the cone by that word
    claims,                               // per-cell witness reading off the cone (assertedBy/deniedBy/settled)
  });
}

export { subjectOf as processSubject };
