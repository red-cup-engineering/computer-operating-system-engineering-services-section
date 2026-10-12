// strings — host string primitives at the charge boundary. Each reads operand charges' value data,
// computes on the host, and wraps the result as an affirmed charge (datum is its own evidence). Computer-
// layer host ops; the math kernel stays clean. A ⊤ operand carries out as ⊤ (the contradiction is held).

export function makeStrings({ valueDatum, fourName, T, F, TOP, BOT, affirm }) {
  const str = (charge) => {
    const d = valueDatum(charge);
    if (d === null || d === undefined) return "";
    return typeof d === "string" ? d : (typeof d === "object" ? JSON.stringify(d) : String(d));
  };
  const anyTop = (charges) => charges.some((c) => fourName(c) === "top");

  return {
    // (str a b …) — concatenate the value data of all operands as strings.
    str: (charges) => {
      if (anyTop(charges)) return TOP;
      return affirm(charges.map(str).join(""));
    },
    // (len s) — the length of a string (or of a JSON-rendered datum). ⊥ if no operand.
    len: (charges) => {
      if (anyTop(charges)) return TOP;
      if (charges.length === 0) return BOT;
      return affirm(str(charges[0]).length);
    },
    // (sub s i j) — substring [i, j) (j optional → to end). Bounds clamped (no host throw).
    sub: (charges) => {
      if (anyTop(charges)) return TOP;
      if (charges.length < 2) return BOT;
      const s = str(charges[0]);
      const i = Number(valueDatum(charges[1])) || 0;
      const j = charges[2] !== undefined ? Number(valueDatum(charges[2])) : s.length;
      return affirm(s.slice(i, j));
    },
    // (upper s) / (lower s) — case folds.
    upper: (charges) => (anyTop(charges) ? TOP : charges.length ? affirm(str(charges[0]).toUpperCase()) : BOT),
    lower: (charges) => (anyTop(charges) ? TOP : charges.length ? affirm(str(charges[0]).toLowerCase()) : BOT),
    // (str= a b) — string equality as a charge (t/f, ⊤ if a side is contested).
    "str=": (charges) => {
      if (anyTop(charges)) return TOP;
      if (charges.length < 2) return T;
      const first = str(charges[0]);
      for (let i = 1; i < charges.length; i++) if (str(charges[i]) !== first) return F;
      return T;
    },
  };
}
