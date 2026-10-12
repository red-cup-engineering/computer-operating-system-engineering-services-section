// cone.ts — the counit/dual cones for each order.
//
// Each order carries a unit/counit cone pair over the one measured carrier:
//   • knowledge — settle (unit, LFP → sheaf, in descent.ts) and brim (counit, GFP → cone).
//   • truth     — adjudicate (unit, LFP → verdict) and presume (counit, GFP → presumption).
// A bit is FREE when its evidence is empty (un-witnessed), GIVEN when witnessed. settle/adjudicate
// leave free bits low; brim/presume raise them to the order's top, then run the same closure. The
// slack between unit and counit is the void cone (read by gap/vanish in void.ts).
import type { Posited, Sheaf, FiberAlgebra, Valuation } from "@561-group/meme";
import {
  commutate,
  possibilizeKnowledge, necessitateKnowledge,
  possibilizeTruth, necessitateTruth,
  lastValuation,
} from "./descent.ts";
import { stringify as S } from "./internal.ts";

// raise each FREE (un-witnessed) bit to the per-axis ceiling, keep GIVEN bits at their measured value.
// `freeNeg` is the value a free negative bit rises to: true for the knowledge-top ⊤ (brim), false for
// the truth-top potential [T,F] (presume). Evidence marks given vs free — no new primitive.
const ceilingWith = (freeNeg: boolean) => (valuation: Valuation): Valuation => ({
  ...valuation,
  "fiber-algebras": valuation["fiber-algebras"].map((fa): FiberAlgebra => ({
    ...fa,
    assignments: fa.assignments.map(({ cell, charge }) => ({
      cell,
      charge: {
        value: [
          charge.evidence[0].length ? charge.value[0] : true,
          charge.evidence[1].length ? charge.value[1] : freeNeg,
        ] as [boolean, boolean],
        evidence: charge.evidence,
      },
    })),
  })),
});

const ceilingKnowledge = ceilingWith(true);  // free negative bit → ⊤
const ceilingTruth    = ceilingWith(false);  // free negative bit → potential [T,F]

// ── the cone exports ─────────────────────────────────────────────────────────────

/** The knowledge greatest-fixed-point generator (the counit-cone). Raises every free bit to ⊤, then
 * runs settle's exact closure — the greatest state consistent with the givens, dual of settle's sheaf. */
export function brim(category: Posited): { cone: Sheaf } {
  const { saturated: presheaf, residue: traces } = commutate(category);
  const ceilingTraces = traces.map((trace) => ({
    ...trace,
    valuations: [ceilingKnowledge(trace.valuations[0]!)],
  }));
  let current: Posited = { presheaf, traces: ceilingTraces };
  let prev: Posited;
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { cone: { base: section.base, section } };
}

/** The truth-axis least-fixed-point generator, the verdict-dual of settle. Iterates ◇_t ∘ □_t on
 * the carrier to its fixed point — the truth reading of the same tellings settle reads knowledge-ward. */
export function adjudicate(category: Posited): { verdict: Sheaf } {
  let current: Posited = category;
  let prev: Posited;
  do {
    prev = current;
    current = possibilizeTruth(necessitateTruth(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { verdict: { base: section.base, section } };
}

/** The truth greatest-fixed-point generator (the counit-cone of the truth order). Raises every free
 * bit toward the truth-top potential [T,F], then runs adjudicate's exact closure — the greatest truth
 * consistent with the givens, dual of adjudicate's verdict. */
export function presume(category: Posited): { presumption: Sheaf } {
  const ceilingTraces = category.traces.map((trace) => ({
    ...trace,
    valuations: [ceilingTruth(trace.valuations[0]!)],
  }));
  let current: Posited = { ...category, traces: ceilingTraces };
  let prev: Posited;
  do {
    prev = current;
    current = possibilizeTruth(necessitateTruth(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { presumption: { base: section.base, section } };
}
