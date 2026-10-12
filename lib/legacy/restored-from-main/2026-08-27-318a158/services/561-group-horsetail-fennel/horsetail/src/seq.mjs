// seq — ordered-collection primitives. A SEQUENCE is the ordered-collection datum a charge already carries
// in its evidence ({seq:[…]}, the same carrier query/section/relate use). These are leaf host primitives:
// eager-eval their args, read/build the {seq:[…]} carrier, return a four-valued charge. map/reduce/filter
// and the comprehensions are Horsetail-source stdlib over these + fn + fold.
//
// BEATS Fennel: seq-head of an EMPTY sequence is ⊥ (no evidence), not a host error; a predicate that
// returns ⊥/⊤ over an element is the language's to interpret (filter keeps/holds), never a crash.

export function makeSeq({ valueDatum, fourName, T, F, TOP, BOT, affirm, isCharge }) {
  // read the {seq:[…]} array a charge carries, or null if it is not a sequence.
  const seqOf = (charge) => {
    const d = valueDatum(charge);
    if (d && typeof d === "object" && Array.isArray(d.seq)) return d.seq;
    return null;
  };
  const asCharge = (x) => (isCharge(x) ? x : affirm(x));
  const mkSeq = (items) => affirm({ seq: items });

  return {
    // (seq a b c …) — build a sequence charge from the evaluated args (each already a charge).
    seq: (charges) => mkSeq(charges),
    // (seq-cons x s) — prepend x (a charge) to sequence s.
    "seq-cons": (charges) => {
      const s = seqOf(charges[1]);
      if (s === null) return BOT;
      return mkSeq([charges[0], ...s]);
    },
    // (seq-head s) — the first element charge; ⊥ if empty/not-a-seq (no evidence, not an error).
    "seq-head": (charges) => {
      const s = seqOf(charges[0]);
      if (s === null || s.length === 0) return BOT;
      return asCharge(s[0]);
    },
    // (seq-tail s) — the sequence without its head; an empty seq's tail is the empty seq.
    "seq-tail": (charges) => {
      const s = seqOf(charges[0]);
      if (s === null) return BOT;
      return mkSeq(s.slice(1));
    },
    // (seq-empty? s) — t if the sequence is empty, f if non-empty, ⊥ if not a sequence.
    "seq-empty?": (charges) => {
      const s = seqOf(charges[0]);
      if (s === null) return BOT;
      return s.length === 0 ? T : F;
    },
    // (seq-len s) — the element count as an affirmed number charge.
    "seq-len": (charges) => {
      const s = seqOf(charges[0]);
      if (s === null) return BOT;
      return affirm(s.length);
    },
    // (seq-nth s i) — the i-th element charge; ⊥ if out of range.
    "seq-nth": (charges) => {
      const s = seqOf(charges[0]);
      const i = Number(valueDatum(charges[1]));
      if (s === null || !(i >= 0 && i < s.length)) return BOT;
      return asCharge(s[i]);
    },
    // (seq-append a b) — concatenate two sequences.
    "seq-append": (charges) => {
      const a = seqOf(charges[0]), b = seqOf(charges[1]);
      if (a === null || b === null) return BOT;
      return mkSeq([...a, ...b]);
    },
  };
}
