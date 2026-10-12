// cone.ts — the counit/dual cones for each order.
//
// Each order carries a unit/counit cone pair over the one measured carrier:
//   • knowledge — settle (unit, LFP → sheaf, in descent.ts) and brim (counit, GFP → cone).
//   • truth     — adjudicate (unit, LFP → verdict) and presume (counit, GFP → presumption).
// A bit is FREE when its evidence is empty (un-witnessed), GIVEN when witnessed. settle/adjudicate
// leave free bits low; brim/presume raise them to the order's top, then run the same closure. The
// slack between unit and counit is the void cone (read by gap/vanish in void.ts).

import {
  commutate,
  possibilizeKnowledge, necessitateKnowledge,
  possibilizeTruth, necessitateTruth,
  lastValuation,
} from "./descent.mjs";
import { chargeSide } from "@lenticule-science/metrologic/articulation/predicating/positing/bilattice-charge";
import { stringify as S } from "./internal.mjs";

// raise each FREE (un-witnessed) bit to the per-axis ceiling, keep GIVEN bits at their measured value.
// `freeNegSide` is the side a free negative bit rises to: present for the knowledge-top ⊤ (brim),
// absent for the truth-top potential [T,F] (presume). Evidence marks given vs free — no new primitive.
const ceilingWith = (freeNegSide) => (valuation) => ({
  ...valuation,
  "fiber-algebras": valuation["fiber-algebras"].map((fa) => ({
    ...fa,
    assignments: fa.assignments.map(({ cell, charge }) => ({
      cell,
      charge: {
        kind: "bilattice-charge.carrier",
        value: [
          charge.evidence[0].length ? charge.value[0] : chargeSide("present"),
          charge.evidence[1].length ? charge.value[1] : freeNegSide,
        ],
        evidence: charge.evidence,
      },
    })),
  })),
});

const ceilingKnowledge = ceilingWith(chargeSide("present"));  // free negative bit → ⊤
const ceilingTruth    = ceilingWith(chargeSide("absent"));  // free negative bit → potential [T,F]

// ── the cone exports ─────────────────────────────────────────────────────────────

/** The knowledge greatest-fixed-point generator (the counit-cone). Raises every free bit to ⊤, then
 * runs settle's exact closure — the greatest state consistent with the givens, dual of settle's sheaf. */
export function brim(category) {
  const { saturated: presheaf, residue: traces } = commutate(category);
  const ceilingTraces = traces.map((trace) => ({
    ...trace,
    valuations: [ceilingKnowledge(trace.valuations[0])],
  }));
  let current = { presheaf, traces: ceilingTraces };
  let prev;
  do {
    prev = current;
    current = possibilizeKnowledge(necessitateKnowledge(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { cone: { base: section.base, section } };
}

/** The truth-axis least-fixed-point generator, the verdict-dual of settle. Iterates ◇_t ∘ □_t on
 * the carrier to its fixed point — the truth reading of the same tellings settle reads knowledge-ward. */
export function adjudicate(category) {
  let current = category;
  let prev;
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
export function presume(category) {
  const ceilingTraces = category.traces.map((trace) => ({
    ...trace,
    valuations: [ceilingTruth(trace.valuations[0])],
  }));
  let current = { ...category, traces: ceilingTraces };
  let prev;
  do {
    prev = current;
    current = possibilizeTruth(necessitateTruth(current));
  } while (S(lastValuation(current)) !== S(lastValuation(prev)));
  const section = lastValuation(current);
  return { presumption: { base: section.base, section } };
}
