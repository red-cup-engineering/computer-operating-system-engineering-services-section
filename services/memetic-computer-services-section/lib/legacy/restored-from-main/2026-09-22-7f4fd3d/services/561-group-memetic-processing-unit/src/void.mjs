// void.ts — the void reads and the non-finite duals.
//
// The slack the descent leaves open. `gap` reads a least fixed point against its greatest and keeps the
// cells they disagree on; `vanish` is that gap for the knowledge order (settle vs brim) — the honest
// knowledge void cone. `estrange` is the transfinite complement-dual of cohere (the never-related pairs);
// `saturate`/`transfer`/`twistor`/`precipitate` are the aperiodic monad (path composition and its
// unsaturable residue), which re-articulate one fold deeper.

import { stringify as S } from "./internal.mjs";
import { present } from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge";
import { cohere, settle } from "./descent.mjs";
import { brim } from "./cone.mjs";

// ── path-composition types ────────────────────────────────────────────────────

/** A segment in the path monad — a cell-shaped edge whose predicate may be a scalar or a
 * composite-label array (when it was produced by saturate's path composition). */

/** A potential holding a collection of path edges — the input/output shape of saturate/transfer. */

const labels = (edge) =>
  Array.isArray(edge.predicate) ? edge.predicate : [edge.predicate];

/** μ of the predication monad: path composition over the void cone read as a graph. Composes edges
 * across a shared object — `(a,p,b)·(b,q,c) ↦ (a,[p,q],c)` — accumulating concepts as the composite's
 * label. An edge never composes with itself. */
export function saturate({ potential }) {
  const composites = [];
  for (let i = 0; i < potential.length; i++) {
    for (let j = 0; j < potential.length; j++) {
      if (i === j) continue;
      const left = potential[i], right = potential[j];
      if (S(left.object) === S(right.subject)) {
        composites.push({ subject: left.subject, predicate: [...labels(left), ...labels(right)], object: right.object });
      }
    }
  }
  return { potential: [...potential, ...composites] };
}

const isAtomic = (edge) =>
  Array.isArray(edge.predicate) ? edge.predicate.length === 1 : true;

/** η of the predication monad: keep only the atomic (uncomposed) path edges (label length 1). The KZ
 * unit's non-invertibility — composites and generators both reopen to atoms. */
export function transfer({ potential }) {
  return { potential: potential.filter(isAtomic) };
}

/** The KZ comparison 2-cell of μ ⊣ η: run `saturate` then `transfer`; `residue` is the concept-sequence
 * each composite accumulated (the labels that never saturate into an object). Non-empty exactly when
 * there was a composable pair. */
export function twistor(potential)

 {
  const saturated = saturate(potential);
  const reopened = transfer(saturated);
  const residue = saturated.potential
    .filter((edge) => labels(edge).length > 1)
    .map(labels);
  return { saturated, reopened, residue };
}

/** The aperiodic greatest-fixed-point generator: what μ CANNOT saturate — the unsaturable concept-sequences
 * (the aperiodic void, H¹≠0) that re-articulate one fold deeper. One unfold step; the infinitude lives
 * in iterating the tower. */
export function precipitate(cone)

 {
  const { saturated, residue } = twistor({ potential: [...cone.apex] });
  return { saturated, residue };
}

/** The transfinite greatest-fixed-point generator, the complement-dual of `cohere`: the pairs NEVER
 * related even after full closure — the complement of the closure within objects×objects. */
export function estrange(category) {
  const closed = cohere(category).residue;
  const predicates = (closed.base.objects).predicates;
  const edges = closed.base.specialization;
  const related = (s, t) =>
    edges.some((e) => S(e.source) === S(s) && S(e.target) === S(t));
  const apex = [];
  for (const source of predicates)
    for (const target of predicates)
      if (!related(source, target)) apex.push({ source, target });
  return { apex };
}

// ── gap and vanish ────────────────────────────────────────────────────────────

/** A cell interval: the full evidence from both the LFP and GFP charges, for auditing the void. */

const value = (charge) => S(present(charge));

/** The honest void cone: read a least fixed point against a greatest and keep the cells they DISAGREE on
 * by VALUE (LFP ≤ GFP everywhere; they coincide where the closure pins a value, split where pinned from
 * neither side). `apex` keeps the bare cells (re-articulable); `evidence` keeps the full interval. */
export function gap({ least, greatest })

 {
  const greatestByCell = new Map();
  for (const fa of greatest["fiber-algebras"])
    for (const { cell, charge } of fa.assignments)
      greatestByCell.set(S(cell), charge);
  const apex = [];
  const evidence = [];
  for (const fa of least["fiber-algebras"])
    for (const { cell, charge } of fa.assignments) {
      const g = greatestByCell.get(S(cell));
      if (g !== undefined && value(charge) !== value(g)) {
        apex.push(cell);
        evidence.push({ cell, least: charge, greatest: g });
      }
    }
  return { apex, evidence };
}

/** The knowledge void cone: `gap(settle, brim)`. The cells the closure pins from NEITHER side — settle
 * leaves them at their measured state, brim leaves them raised. Runs both fixed points and takes their
 * gap (a single section cannot tell a genuinely-void cell from a reconciled-conflict ⊥ without the GFP). */
export function vanish(category)

 {
  return gap({
    least: settle(category).sheaf.section,
    greatest: brim(category).cone.section,
  });
}
