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
import type {
  Utterance, Cell, Meme,
  Edge, EntitySet, PredicateSet, CellSet, BaseCategory,
  Fiber, FiberAlgebra, Valuation, Trace,
  Predicated, Posited, PositPresheaf, Sheaf,
} from "@561-group/meme";
import {
  type Charge, type ChargePair,
  isTop, joinKnowledge, meetKnowledge, joinTruth, meetTruth,
} from "./charge.ts";
import { stringify as S } from "./internal.ts";

// ── MPU-internal intermediate type ───────────────────────────────────────────

/** Potential: the articulated utterance held open — both slots empty, awaiting predication.
 * MPU-internal; not part of the meme vocabulary. */
export interface Potential {
  readonly potential: readonly unknown[];
}

// ── articulate, predicate ────────────────────────────────────────────────────

/** The root morphism: witness a thing into a potential. It asserts NO semantics about the parts —
 * `predicate` later reads the left as the entity dimension and the right as the predicate dimension. */
export function articulate(thing: Utterance | { readonly apex: readonly unknown[] }): Potential {
  if (thing && !Array.isArray(thing) && "apex" in thing) return { potential: [...thing.apex] };
  const [left, right] = thing as Utterance;
  if (left === undefined || right === undefined) {
    throw new TypeError("articulate: malformed utterance — expected [left, right], both given");
  }
  return { potential: [left, right] };
}

const initialPredicateCategory = (predicateSet: PredicateSet): BaseCategory => ({
  objects: predicateSet,
  specialization: [],
  converse: [],
  "subject-projection": [],
  "object-projection": [],
});

/** The transfinite generator: read the potential cell `[token, claim]` as E × Π × E; emit the cell-set
 * and the value-free fiber over it. */
export function predicate(category: Potential): Predicated {
  const [object, concept] = category.potential;
  const entitySet: EntitySet = { entities: [object] };
  const predicateSet: PredicateSet = { predicates: [concept] };
  const cellSet: CellSet = { "entity-set": entitySet, "predicate-set": predicateSet };
  return {
    "cell-set": cellSet,
    fiber: { "cell-set": cellSet, base: initialPredicateCategory(predicateSet), "entity-set": entitySet },
  };
}

// ── cohere (composition-closure of the base) ─────────────────────────────────

function closeSpecialization(specialization: readonly Edge[]): Edge[] {
  const edges: Array<[unknown, unknown]> = specialization.map((e) => [e.source, e.target]);
  const has = (a: unknown, b: unknown): boolean => edges.some(([s, t]) => S(s) === S(a) && S(t) === S(b));
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
const closeBase = (base: BaseCategory): BaseCategory => ({
  ...base,
  specialization: closeSpecialization(base.specialization),
});

/** The transfinite coherence (Beck–Chevalley): `saturated` = the relational cell-set; `residue` = the
 * value-free fiber over the composition-closed base `posit` consumes. */
export function cohere(category: Predicated): { saturated: CellSet; residue: Fiber } {
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
export function posit(category: Predicated): Posited {
  const { residue: fiber } = cohere(category);
  const entitySet = fiber["entity-set"];
  const entities = entitySet.entities;
  const predicates = fiber["cell-set"]["predicate-set"].predicates;
  const fibers: FiberAlgebra[] = predicates.map((pred) => ({
    "entity-set": entitySet,
    assignments: entities.flatMap((subject) =>
      entities.map((object): Meme => ({
        cell: { subject, predicate: pred, object },
        charge: { value: [true, false], evidence: [[subject], []] },
      })),
    ),
    predicate: pred,
  }));
  const presheaf: PositPresheaf = { fiber, base: fiber.base, "entity-set": fiber["entity-set"], fibers };
  const valuation: Valuation = { base: fiber.base, "fiber-algebras": fibers };
  return { presheaf, traces: [{ valuations: [valuation] }] };
}

/** The scott-continuous coherence (◇□ = □◇): `saturated` = the presheaf; `residue` = the traces. */
export function commutate(category: Posited): { saturated: PositPresheaf; residue: readonly Trace[] } {
  return { saturated: category.presheaf, residue: category.traces };
}

// ── the modal calculus ───────────────────────────────────────────────────────

const modalStep =
  (fold: (pair: ChargePair) => Charge) =>
  (valuation: Valuation): Valuation => {
    const algebras = valuation["fiber-algebras"].map((fa): FiberAlgebra => {
      const byCell = new Map<string, Charge>();
      for (const { cell, charge } of fa.assignments) {
        const k = S(cell);
        const prior = byCell.get(k);
        byCell.set(k, prior ? fold({ left: prior, right: charge }) : charge);
      }
      const seen = new Set<string>();
      const assignments: Meme[] = [];
      for (const { cell } of fa.assignments) {
        const k = S(cell);
        if (seen.has(k)) continue;
        seen.add(k);
        assignments.push({ cell, charge: byCell.get(k)! });
      }
      return { ...fa, assignments };
    });
    return { ...valuation, "fiber-algebras": algebras };
  };

const appendValuation =
  (step: (v: Valuation) => Valuation) =>
  (category: Posited): Posited => ({
    ...category,
    traces: category.traces.map((trace) => {
      const vs = trace.valuations;
      return { ...trace, valuations: [...vs, step(vs[vs.length - 1]!)] };
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
export const lastValuation = (cat: Posited): Valuation => {
  const vs = cat.traces[0]!.valuations;
  return vs[vs.length - 1]!;
};

// ── settle (the fixed-point closure) and compare ─────────────────────────────

/** The finite generator: iterate the commutating closure to its knowledge-least fixed point (unique by
 * confluence; terminates by Knaster–Tarski over the bounded knowledge lattice). */
export function settle(category: Posited): { sheaf: Sheaf } {
  const { saturated: presheaf, residue: traces } = commutate(category);
  let current: Posited = { presheaf, traces };
  let prev: Posited;
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
export function settleTraced(category: Posited): {
  sheaf: Sheaf;
  history: readonly Valuation[];
  depth: number;
} {
  const { saturated: presheaf, residue: traces } = commutate(category);
  let current: Posited = { presheaf, traces };
  let prev: Posited;
  let depth = 0;
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
    depth++;
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { sheaf: { base: section.base, section }, history: current.traces[0]!.valuations, depth };
}

const keep = (valuation: Valuation, pred: (c: Charge) => boolean): Valuation => ({
  ...valuation,
  "fiber-algebras": valuation["fiber-algebras"].map((fa) => ({
    ...fa,
    assignments: fa.assignments.filter(({ charge }) => pred(charge)),
  })),
});

/** Split a section into its consistent part (cells valued absurd/potential/active) and its
 * paraconsistent part (cells valued stable / ⊤ — the inconsistency locus, "told both"). */
export function compare(valuation: Valuation): { consistent: Valuation; paraconsistent: Valuation } {
  return {
    consistent: keep(valuation, (c) => !isTop(c)),
    paraconsistent: keep(valuation, isTop),
  };
}
