// arith — host arithmetic & comparison primitives, REFRAMED at the charge boundary. Each op READS its
// operand charges' value data, computes on the host, and WRAPS the result as an AFFIRMED charge (the datum
// is its own evidence — exactly evalLiteral's contract). These are computer-LAYER host ops, not math: the
// math kernel stays clean; this is the language edge that lets numbers ride a charge's evidence.
//
// Comparison BEATS Fennel: `=`/`<`/`>` return a CHARGE, not a boolean. Equal → t, unequal → f, and a
// comparison where either side is ⊤ (held-contradictory) → ⊤ (the dispute is carried, not forced to a
// boolean). OpenFork resolved: = reflects the subject's charge — ⊤ in → ⊤ out.
//
// The factory takes the evaluator's surface (how to read a value datum off a charge, the four readers, and
// the charge points) so this file imports nothing from the evaluator (no cycle).

export function makeArith({ valueDatum, fourName, T, F, TOP, BOT, affirm }) {
  const num = (charge) => {
    const d = valueDatum(charge);
    const n = typeof d === "number" ? d : Number(d);
    return Number.isNaN(n) ? null : n;
  };
  // fold a numeric reduction over evaluated arg charges; a non-numeric operand makes the result ⊥ (no
  // evidence to compute on) rather than a host NaN crash.
  const nums = (charges) => {
    const out = [];
    for (const c of charges) { const n = num(c); if (n === null) return null; out.push(n); }
    return out;
  };
  // anyTop — if any operand is ⊤, the comparison/arith carries the contradiction out as ⊤.
  const anyTop = (charges) => charges.some((c) => fourName(c) === "top");

  const arithFold = (reduce, identity) => (charges) => {
    if (anyTop(charges)) return TOP;
    const ns = nums(charges);
    if (ns === null) return BOT;
    if (ns.length === 0) return affirm(identity);
    return affirm(ns.reduce(reduce));
  };

  const cmp = (test) => (charges) => {
    if (anyTop(charges)) return TOP;           // comparing a contradiction → ⊤ (the beat)
    const ns = nums(charges);
    if (ns === null) return BOT;
    for (let i = 1; i < ns.length; i++) if (!test(ns[i - 1], ns[i])) return F;
    return T;
  };

  return {
    "+": arithFold((a, b) => a + b, 0),
    "-": (charges) => {
      if (anyTop(charges)) return TOP;
      const ns = nums(charges);
      if (ns === null) return BOT;
      if (ns.length === 0) return affirm(0);
      if (ns.length === 1) return affirm(-ns[0]);
      return affirm(ns.reduce((a, b) => a - b));
    },
    "*": arithFold((a, b) => a * b, 1),
    "/": (charges) => {
      if (anyTop(charges)) return TOP;
      const ns = nums(charges);
      if (ns === null) return BOT;
      if (ns.length === 1) return affirm(1 / ns[0]);
      return affirm(ns.reduce((a, b) => a / b));
    },
    "%": (charges) => {
      if (anyTop(charges)) return TOP;
      const ns = nums(charges);
      if (ns === null || ns.length < 2) return BOT;
      return affirm(ns.reduce((a, b) => a % b));
    },
    // value EQUALITY as a charge: equal data → t, unequal → f, ⊤ side → ⊤. Compares value data (not the
    // FOUR), so (= 1 1) is t and (= 1 2) is f; (= x y) over a contested x is ⊤.
    "=": (charges) => {
      if (anyTop(charges)) return TOP;
      if (charges.length < 2) return T;
      const first = JSON.stringify(valueDatum(charges[0]));
      for (let i = 1; i < charges.length; i++) if (JSON.stringify(valueDatum(charges[i])) !== first) return F;
      return T;
    },
    "<": cmp((a, b) => a < b),
    ">": cmp((a, b) => a > b),
    "<=": cmp((a, b) => a <= b),
    ">=": cmp((a, b) => a >= b),
  };
}
