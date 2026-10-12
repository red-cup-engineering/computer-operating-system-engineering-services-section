// descent.ts — the four-regime descent and its modal closure: the MPU's instruction set. This is the
// structure-preserving processing — it carries category structure (cell-sets, fibers, presheaves,
// traces, valuations, sheaves) THROUGH the regimes and never collapses it to a scalar. An utterance
// `[token, claim]` settles to a glued sheaf SECTION through
//     articulate → predicate → (cohere) → posit → (commutate) → settle.
// `posit` MEASURES each cell from its givens (it never seeds a value); the modal generators
// `possibilize`/`necessitate` raise/lower across the fiber-algebras on each order (the modal calculus);
// `settle` iterates the knowledge closure to its least fixed point (the sheaf); `compare` splits a
// settled section into its consistent and paraconsistent (stable / ⊤) parts.
//
// Data types are sourced from @561-group/meme; this module owns the processing.

import {
  charge, chargeValue, isTop, joinKnowledge, meetKnowledge, joinTruth, meetTruth,
} from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge";
import { opaqueWitness as mark } from "@lenticule-science/metrologic/articulation/predicating/positing/opaque-coincidence";
import { stringify as S } from "./internal.mjs";

// ── MPU-internal intermediate type ───────────────────────────────────────────

/** Potential: the articulated utterance held open — both slots empty, awaiting predication.
 * MPU-internal; not part of the meme vocabulary. */

// ── articulate, predicate ────────────────────────────────────────────────────

/** The root morphism: witness a thing into a potential. It asserts NO semantics about the parts —
 * `predicate` later reads the left as the entity dimension and the right as the predicate dimension. */
export function articulate(thing) {
  if (thing && !Array.isArray(thing) && "apex" in thing) return { potential: [...thing.apex] };
  const [left, right] = thing;
  if (left === undefined || right === undefined) {
    throw new TypeError("articulate: malformed utterance — expected [left, right], both given");
  }
  return { potential: [left, right] };
}

const initialPredicateCategory = (predicateSet) => ({
  objects: predicateSet,
  specialization: [],
  converse: [],
  "subject-projection": [],
  "object-projection": [],
});

/** The transfinite generator: read the potential cell `[token, claim]` as E × Π × E; emit the cell-set
 * and the value-free fiber over it. */
export function predicate(category) {
  const [object, concept] = category.potential;
  const entitySet = { entities: [object] };
  const predicateSet = { predicates: [concept] };
  const cellSet = { "entity-set": entitySet, "predicate-set": predicateSet };
  return {
    "cell-set": cellSet,
    fiber: { "cell-set": cellSet, base: initialPredicateCategory(predicateSet), "entity-set": entitySet },
  };
}

// ── cohere (composition-closure of the base) ─────────────────────────────────

function closeSpecialization(specialization) {
  const edges = specialization.map((e) => [e.source, e.target]);
  const has = (a, b) => edges.some(([s, t]) => S(s) === S(a) && S(t) === S(b));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of [...edges])
      for (const [c, d] of [...edges]) {
        if (S(b) === S(c) && S(a) !== S(d) && !has(a, d)) {
          edges.push([a, d]);
          changed = true;
        }
      }
  }
  return edges.map(([source, target]) => ({ source, target }));
}
const closeBase = (base) => ({
  ...base,
  specialization: closeSpecialization(base.specialization),
});

/** The transfinite coherence (Beck–Chevalley): `saturated` = the relational cell-set; `residue` = the
 * value-free fiber over the composition-closed base `posit` consumes. */
export function cohere(category) {
  const fiber = category.fiber;
  return {
    saturated: category["cell-set"],
    residue: { "cell-set": fiber["cell-set"], base: closeBase(fiber.base), "entity-set": fiber["entity-set"] },
  };
}

// ── posit (measure each cell from its givens) ────────────────────────────────

/** The scott-continuous generator: package the fiber as a PositPresheaf whose stalks take charges, and
 * MEASURE each cell — the knowledge bit is witnessed by the given token, the truth bit is FREE, so a
 * fresh cell measures potential [T,F], never a stamped absurd ⊥. */
export function posit(category) {
  const { residue: fiber } = cohere(category);
  const entitySet = fiber["entity-set"];
  const entities = entitySet.entities;
  const predicates = fiber["cell-set"]["predicate-set"].predicates;
  const fibers = predicates.map((pred) => ({
    "entity-set": entitySet,
    assignments: entities.flatMap((subject) =>
      entities.map((object) => ({
        cell: { subject, predicate: pred, object },
        charge: charge(chargeValue("potential"), [[mark(subject)], []]),
      })),
    ),
    predicate: pred,
  }));
  const presheaf = { fiber, base: fiber.base, "entity-set": fiber["entity-set"], fibers };
  const valuation = { base: fiber.base, "fiber-algebras": fibers };
  return { presheaf, traces: [{ valuations: [valuation] }] };
}

/** The scott-continuous coherence (◇□ = □◇): `saturated` = the presheaf; `residue` = the traces. */
export function commutate(category) {
  return { saturated: category.presheaf, residue: category.traces };
}

// ── the modal calculus ───────────────────────────────────────────────────────

const modalStep =
  (fold) =>
  (valuation) => {
    const algebras = valuation["fiber-algebras"].map((fa) => {
      const byCell = new Map();
      for (const { cell, charge } of fa.assignments) {
        const k = S(cell);
        const prior = byCell.get(k);
        byCell.set(k, prior ? fold(prior, charge) : charge);
      }
      const seen = new Set();
      const assignments = [];
      for (const { cell } of fa.assignments) {
        const k = S(cell);
        if (seen.has(k)) continue;
        seen.add(k);
        assignments.push({ cell, charge: byCell.get(k) });
      }
      return { ...fa, assignments };
    });
    return { ...valuation, "fiber-algebras": algebras };
  };

const appendValuation =
  (step) =>
  (category) => ({
    ...category,
    traces: category.traces.map((trace) => {
      const vs = trace.valuations;
      return { ...trace, valuations: [...vs, step(vs[vs.length - 1])] };
    }),
  });

/** Raise a valuation to the knowledge-join across its fiber-algebras (◇_k's step). */
export const raiseKnowledge = modalStep(joinKnowledge);
/** Lower a valuation to the knowledge-meet across its fiber-algebras (□_k's step). */
export const lowerKnowledge = modalStep(meetKnowledge);
/** Raise a valuation to the truth-join across its fiber-algebras (◇_t's step). */
export const raiseTruth = modalStep(joinTruth);
/** Lower a valuation to the truth-meet across its fiber-algebras (□_t's step). */
export const lowerTruth = modalStep(meetTruth);

/** ◇_k — append the knowledge-raised valuation. */
export const possibilizeKnowledge = appendValuation(raiseKnowledge);
/** □_k — append the knowledge-lowered valuation. */
export const necessitateKnowledge = appendValuation(lowerKnowledge);
/** ◇_t — append the truth-raised valuation. */
export const possibilizeTruth = appendValuation(raiseTruth);
/** □_t — append the truth-lowered valuation. */
export const necessitateTruth = appendValuation(lowerTruth);

/** The last valuation of a category's first trace — the current state of the closure. */
export const lastValuation = (cat) => {
  const vs = cat.traces[0].valuations;
  return vs[vs.length - 1];
};

// ── settle (the fixed-point closure) and compare ─────────────────────────────

/** The finite generator: iterate the commutating closure to its knowledge-least fixed point (unique by
 * confluence; terminates by Knaster–Tarski over the bounded knowledge lattice). */
export function settle(category) {
  const { saturated: presheaf, residue: traces } = commutate(category);
  let current = { presheaf, traces };
  let prev;
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { sheaf: { base: section.base, section } };
}

/** settle with full trace: same fixed-point closure as `settle`, but also returns the sequence of
 * valuations through each modal step and the `depth` (number of necessitate+possibilize pairs applied).
 * The history includes the initial valuation at index 0 and two entries per iteration after that. */
export function settleTraced(category)

 {
  const { saturated: presheaf, residue: traces } = commutate(category);
  let current = { presheaf, traces };
  let prev;
  let depth = 0;
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
    depth++;
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { sheaf: { base: section.base, section }, history: current.traces[0].valuations, depth };
}

const keep = (valuation, pred) => ({
  ...valuation,
  "fiber-algebras": valuation["fiber-algebras"].map((fa) => ({
    ...fa,
    assignments: fa.assignments.filter(({ charge }) => pred(charge)),
  })),
});

/** Split a section into its consistent part (cells valued absurd/potential/active) and its
 * paraconsistent part (cells valued stable / ⊤ — the inconsistency locus, "told both"). */
export function compare(valuation) {
  return {
    consistent: keep(valuation, (c) => !isTop(c)),
    paraconsistent: keep(valuation, isTop),
  };
}
