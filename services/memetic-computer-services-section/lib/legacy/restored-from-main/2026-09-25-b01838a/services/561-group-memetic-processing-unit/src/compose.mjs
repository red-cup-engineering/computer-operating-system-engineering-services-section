// compose.ts — drive the single-utterance descent over a whole KNOWLEDGE BASE and compose the results
// into one settled SECTION: a valuation whose fiber-algebras carry every cell with its FOLDED word.
//
// Witness forms:
//   [subject, claim]               — affirmation; cell object = subject (self-referential)
//   [subject, claim, false]        — denial; cell object = subject
//   [subject, claim, object]       — affirmation with explicit object (object !== false)
//   [subject, claim, object, false] — denial with explicit object
//
// Witnesses of the same cell fold by the knowledge-join: agreement stays definite, an affirmation met
// with a denial rises to stable, and a never-witnessed cell is absurd.

import { bottom, chargeValueName, negate, joinKnowledge, valueOf } from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge";
import { articulate, predicate, posit, settle, settleTraced } from "@red-cup-engineering/computer-systems-engineering-services-section/signcraft/descent";
import { stringify as S } from "./internal.mjs";

/** A witnessed articulation.  Disambiguation: if w[2] === false → self-ref denial; if w[3] === false
 * → explicit-object denial; otherwise w[2] (if present) is the explicit object.
 *   [subject, claim]               — affirmation; cell object = subject (self-referential)
 *   [subject, claim, false]        — denial;       cell object = subject
 *   [subject, claim, object]       — affirmation; cell object = object  (object !== false)
 *   [subject, claim, object, false] — denial;      cell object = object */

/** The single-utterance descent to its settled meme `{ cell, charge }`. */
export function settleOne(utterance) {
  const { sheaf } = settle(posit(predicate(articulate(utterance))));
  const fa = sheaf.section["fiber-algebras"][0];
  return fa.assignments[0];
}

/** compose(witnesses) — drive each witness through the descent, fold witnesses of the same cell by
 * knowledge-join (denials negated first), and assemble the settled SECTION. */
export function compose(witnesses) {
  const folded = new Map();
  const order = [];
  const edgeKeys = new Set();
  const edges = [];
  const objects = new Map();
  const note = (x) => { objects.set(S(x), x); };

  for (const w of witnesses) {
    const [token, claim] = w;
    const denied = (w.length === 3 && w[2] === false) || (w.length === 4 && w[3] === false);
    const hasObject = w.length >= 3 && w[2] !== false;
    const object = hasObject ? w[2] : token;
    const fact = settleOne([token, claim]);
    const cell = { subject: token, predicate: claim, object };
    const charge = denied ? negate(fact.charge) : fact.charge;
    const key = S(cell);
    const prior = folded.get(key);
    folded.set(key, { cell, charge: prior ? joinKnowledge(prior.charge, charge) : charge });
    if (!prior) order.push(key);

    note(token);
    note(claim);
    if (hasObject) note(object);
    const ek = S([claim, token]);
    if (!edgeKeys.has(ek)) { edgeKeys.add(ek); edges.push({ source: claim, target: token }); }
  }

  const byPredicate = new Map();
  const predicateOrder = [];
  for (const key of order) {
    const a = folded.get(key);
    const pk = S(a.cell.predicate);
    let bucket = byPredicate.get(pk);
    if (!bucket) { bucket = []; byPredicate.set(pk, bucket); predicateOrder.push(a.cell.predicate); }
    bucket.push(a);
  }

  const fibers = predicateOrder.map((p) => {
    const assignments = byPredicate.get(S(p));
    const ents = new Map();
    for (const { cell } of assignments) { ents.set(S(cell.subject), cell.subject); ents.set(S(cell.object), cell.object); }
    const entitySet = { entities: [...ents.values()] };
    return { "entity-set": entitySet, assignments, predicate: p };
  });

  const base = {
    objects: [...objects.values()],
    specialization: edges,
    converse: [],
    "subject-projection": [],
    "object-projection": [],
  };
  const section = { base, "fiber-algebras": fibers };
  return { base, section };
}

// ── projections ──────────────────────────────────────────────────────────────

/** The four process charges exposed by the MPU. */

export function memeChargeOf(charge) {
  return chargeValueName(valueOf(charge));
}

/** Read the folded word of one cell out of a settled section (absurd if the cell was never witnessed). */
export function chargeAt(section, cell) {
  const k = S(cell);
  for (const fa of section["fiber-algebras"]) {
    for (const a of fa.assignments) if (S(a.cell) === k) return a.charge;
  }
  return bottom;
}

// ── KB-level Posited ─────────────────────────────────────────────────────────

/** Wrap an assembled section as a KB-level Posited so it can be fed to brim/adjudicate/presume/vanish.
 * The cone/void operations only drive the traces through the modal closure — they do not read the
 * presheaf — so the presheaf here is a structural wrapper, not a re-derived product. */
export function positedFrom(section) {
  const predicates = section["fiber-algebras"].map((fa) => fa.predicate);
  const entityMap = new Map();
  for (const fa of section["fiber-algebras"])
    for (const e of fa["entity-set"].entities) entityMap.set(S(e), e);
  const entitySet = { entities: [...entityMap.values()] };
  const predicateSet = { predicates };
  const cellSet = { "entity-set": entitySet, "predicate-set": predicateSet };
  const fiber = { "cell-set": cellSet, base: section.base, "entity-set": entitySet };
  const presheaf = {
    fiber,
    base: section.base,
    "entity-set": entitySet,
    fibers: [...section["fiber-algebras"]],
  };
  return { presheaf, traces: [{ valuations: [section] }] };
}

/** settleOneTraced: single-utterance descent with the full valuation history and depth. */
export function settleOneTraced(utterance)

 {
  const { sheaf, history, depth } = settleTraced(posit(predicate(articulate(utterance))));
  const fa = sheaf.section["fiber-algebras"][0];
  return { meme: fa.assignments[0], history, depth };
}
