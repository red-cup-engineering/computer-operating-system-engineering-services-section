// charge.ts — the process-local charge vocabulary.
//
// Memetics speaks in named process charges directly:
//   potential — admitted, ready to advance
//   active    — denied
//   absurd    — unsettled, no mark yet
//   stable    — contradicted, held as data

export const MEME_CHARGE = Object.freeze({
  POTENTIAL: "potential",
  ACTIVE: "active",
  ABSURD: "absurd",
  STABLE: "stable",
});

export const MEME_CHARGES = Object.freeze([
  MEME_CHARGE.POTENTIAL,
  MEME_CHARGE.ACTIVE,
  MEME_CHARGE.ABSURD,
  MEME_CHARGE.STABLE,
]);

const RANK = { stable: 0, active: 1, absurd: 2, potential: 3 };

export function isMemeCharge(value) {
  return typeof value === "string" && (MEME_CHARGES).includes(value);
}

export function asMemeCharge(value) {
  if (isMemeCharge(value)) return value;
  throw new TypeError(`not a MemeCharge: ${JSON.stringify(value)}`);
}

/** The admissibility meet: worst obstruction wins. */
export function meetAdmissibility(a, b) {
  return RANK[a] <= RANK[b] ? a : b;
}

/** Fold independent charges to one composite verdict under the admissibility chain. */
export function foldCharges(values) {
  let acc = "potential";
  for (const v of values) acc = meetAdmissibility(acc, v);
  return acc;
}

/** A process is admitted exactly when its composite charge is potential. */
export function isAdmitted(charge) {
  return charge === "potential";
}

export function createMemeChargeCarrier(
  points,
  states,
  valueAt,
  options = {},
) {
  const frozenPoints = Object.freeze([...points]);
  const frozenStates = Object.freeze([...states]);
  const stateSet = new Set(frozenStates);
  const absent = options.absent ?? "absurd";

  return Object.freeze({
    kind: "meme-charge.carrier",
    points: frozenPoints,
    states: frozenStates,
    absent,
    at(point, state) {
      if (!stateSet.has(state)) return absent;
      return valueAt(point, state) ?? absent;
    },
  });
}
