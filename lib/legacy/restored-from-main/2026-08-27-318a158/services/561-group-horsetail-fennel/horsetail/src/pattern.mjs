// pattern — the four-valued matcher. This is where Horsetail BEATS Fennel HARD: a pattern match does not
// return boolean-or-fail, it returns a FOUR-valued match charge:
//   t   MATCH        — the pattern matched the subject
//   f   FAIL         — the pattern did not match
//   ⊥   UNDETERMINED — the subject is still settling (no evidence on the matched cell)
//   ⊤   CONTEST      — the subject is HELD-contradictory on the matched cell (told both)
// A clause whose subject is ⊤ can still match and run its body BOUND to the ⊤ value (branch on the
// contradiction) — pcall/error languages crash long before this point.
//
// Patterns (cells/atoms, homoiconic):
//   _              wildcard — matches anything, binds nothing
//   ?x             binder — matches anything, binds x to the subject charge
//   t f ⊥ ⊤        charge literal — matches iff the subject's FOUR equals it (⊤ subject vs ⊤ pat → ⊤-match)
//   42  "s"        scalar literal — matches iff the subject's value datum equals it
//   (or p…)        alternation — matches iff ANY alternative matches (knowledge-joins their match charges)
//   (and p…)       conjunction — matches iff ALL match (bindings union); useful with ?x to bind+test
//   (? guardfn p)  guarded — match p AND the guard fn applied to the subject settles t
//   (s p o)        predication pattern — destructures a charge carrying a {cell:[…]} / {seq:[…]} / {values:[…]}
//
// Pure over charges + a small `helpers` surface the evaluator passes in (equality on value data, the four
// readers, charge constructors, and apply for guards). No node:fs, no eval here — the evaluator owns those.

// matchCell(pattern, subject, helpers) -> { four, bindings }. `four` is one of "t"/"f"/"bot"/"top".
// bindings is a Map<name, charge>. The matcher NEVER throws on a ⊤ subject — it reports ⊤ and still binds.
export function matchCell(pattern, subject, helpers) {
  const { isSym, isCell, isChargeLit, fourName, valueDatum, jsonEq } = helpers;

  // wildcard
  if (isSym(pattern) && pattern.name === "_") return { four: "t", bindings: new Map() };

  // binder ?x
  if (isSym(pattern) && pattern.name.startsWith("?")) {
    const name = pattern.name.slice(1);
    return { four: "t", bindings: new Map([[name, subject]]) };
  }

  // in DESTRUCTURING mode (let/fn params), a plain Sym is a binder too (no `?` needed): bind it to the
  // subject. (In match mode a plain Sym is a literal-symbol equality test — see below.)
  if (helpers.bindBare && isSym(pattern) && pattern.name !== "_" && pattern.name !== ".") {
    return { four: "t", bindings: new Map([[pattern.name, subject]]) };
  }

  // charge literal: compare FOUR. A ⊤ pattern against a ⊤ subject is a ⊤-MATCH (the beat: we matched a
  // contradiction). Equal FOUR otherwise → t; unequal → f.
  if (isChargeLit(pattern)) {
    const subjFour = fourName(subject);
    if (pattern.four === subjFour) return { four: subjFour === "top" ? "top" : "t", bindings: new Map() };
    return { four: "f", bindings: new Map() };
  }

  // scalar literal (number/string/boolean): compare the subject's value datum.
  if (typeof pattern === "number" || typeof pattern === "string" || typeof pattern === "boolean") {
    const d = valueDatum(subject);
    if (jsonEq(d, pattern)) {
      // if the subject itself is held-contradictory, report ⊤ (matched a contested cell), else t.
      return { four: fourName(subject) === "top" ? "top" : "t", bindings: new Map() };
    }
    return { four: "f", bindings: new Map() };
  }

  // a plain Sym that is NOT a binder/wildcard: a LITERAL symbol pattern — match iff the subject's value
  // datum equals the symbol's name (so a quoted symbol in a sequence matches).
  if (isSym(pattern)) {
    const d = valueDatum(subject);
    if (jsonEq(d, pattern.name)) return { four: fourName(subject) === "top" ? "top" : "t", bindings: new Map() };
    return { four: "f", bindings: new Map() };
  }

  if (isCell(pattern)) {
    const headName = isSym(pattern[0]) ? pattern[0].name : null;

    // (or p…) — alternation. The match charge is the knowledge-join over alternatives; bindings come from
    // the FIRST alternative that matches (t or ⊤).
    if (headName === "or") {
      let best = { four: "f", bindings: new Map() };
      for (let i = 1; i < pattern.length; i++) {
        const m = matchCell(pattern[i], subject, helpers);
        if (m.four === "t" || m.four === "top") return m;
        if (m.four === "bot" && best.four === "f") best = m;
      }
      return best;
    }

    // (and p…) — conjunction. All must match; bindings union. The result four is the truth-meet of the
    // arms' fours (worst case wins: any f → f; any ⊥ → ⊥ unless an f; ⊤ surfaces).
    if (headName === "and") {
      const bindings = new Map();
      let four = "t";
      for (let i = 1; i < pattern.length; i++) {
        const m = matchCell(pattern[i], subject, helpers);
        for (const [k, v] of m.bindings) bindings.set(k, v);
        four = meetFour(four, m.four);
      }
      return { four, bindings };
    }

    // (? guard p) — guarded match: match p, then require the guard fn applied to the subject to settle t.
    if (headName === "?") {
      const guardForm = pattern[1];
      const inner = pattern[2] !== undefined ? pattern[2] : { name: "_", __sym: true };
      const m = matchCell(inner, subject, helpers);
      if (m.four === "f") return m;
      const guardOk = helpers.runGuard(guardForm, subject, m.bindings);
      const gf = fourName(guardOk);
      if (gf === "t") return m;
      if (gf === "top") return { four: "top", bindings: m.bindings };
      return { four: "f", bindings: m.bindings };
    }

    // predication/sequence pattern (s p o) / (a b …): destructure the subject's carried collection.
    return matchSequence(pattern, subject, helpers);
  }

  return { four: "f", bindings: new Map() };
}

// matchSequence — a cell pattern matches a subject carrying an ordered collection ({cell:[…]}/{seq:[…]}/
// {values:[…]}) element-wise. A dotted-tail `. rest` binds the remaining elements as a seq. Used by both
// match and destructuring (let/fn pattern params).
function matchSequence(pattern, subject, helpers) {
  const { wrapDatum } = helpers;
  const elems = subjectElements(subject, helpers);
  if (elems === null) return { four: "f", bindings: new Map() }; // not a collection
  const bindings = new Map();
  let four = "t";
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (helpers.isSym(p) && p.name === ".") {                 // dotted tail
      const restName = pattern[i + 1];
      const rest = wrapDatum({ seq: elems.slice(i) });
      if (helpers.isSym(restName) && restName.name.startsWith("?")) bindings.set(restName.name.slice(1), rest);
      return { four, bindings };
    }
    if (i >= elems.length) return { four: "f", bindings }; // pattern longer than the data
    const m = matchCell(p, elems[i], helpers);
    if (m.four === "f") return { four: "f", bindings };
    for (const [k, v] of m.bindings) bindings.set(k, v);
    four = meetFour(four, m.four);
  }
  // require exact length unless a dotted tail consumed the rest.
  if (elems.length !== pattern.length) return { four: "f", bindings };
  return { four, bindings };
}

// subjectElements — the ordered charges a subject carries, or null if it is not a collection. Reads the
// {seq:[…]} / {cell:[…]} / {values:[…]} carriers; raw charges in a seq are returned as-is, raw cell-data
// is wrapped to a charge.
function subjectElements(subject, helpers) {
  const d = subject && subject.evidence && subject.evidence[0] && subject.evidence[0][0];
  if (d && typeof d === "object") {
    if (Array.isArray(d.seq)) return d.seq.map((x) => helpers.asCharge(x));
    if (Array.isArray(d.values)) return d.values;
    if (Array.isArray(d.cell)) return d.cell.map((x) => helpers.wrapDatum(x));
  }
  return null;
}

// meetFour — the truth-meet of two FOUR names (for conjunctive matches): f dominates, then ⊥, then ⊤
// surfaces over t. (Matches the kernel's truth order intuition without importing it: this is a small,
// pattern-local combiner over the result labels.)
function meetFour(a, b) {
  if (a === "f" || b === "f") return "f";
  if (a === "bot" || b === "bot") return "bot";
  if (a === "top" || b === "top") return "top";
  return "t";
}
