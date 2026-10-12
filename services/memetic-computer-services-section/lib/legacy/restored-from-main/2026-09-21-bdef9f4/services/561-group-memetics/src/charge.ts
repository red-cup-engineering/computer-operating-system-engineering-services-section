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
} as const);

export const MEME_CHARGES = Object.freeze([
  MEME_CHARGE.POTENTIAL,
  MEME_CHARGE.ACTIVE,
  MEME_CHARGE.ABSURD,
  MEME_CHARGE.STABLE,
] as const);

export type MemeCharge = typeof MEME_CHARGES[number];

export type MemeChargeCarrier<State extends string = string> = Readonly<{
  kind: "meme-charge.carrier";
  points: readonly string[];
  states: readonly State[];
  absent: MemeCharge;
  at(point: string, state: State | string): MemeCharge;
}>;

const RANK: Record<MemeCharge, number> = { stable: 0, active: 1, absurd: 2, potential: 3 };

export function isMemeCharge(value: unknown): value is MemeCharge {
  return typeof value === "string" && (MEME_CHARGES as readonly string[]).includes(value);
}

export function asMemeCharge(value: unknown): MemeCharge {
  if (isMemeCharge(value)) return value;
  throw new TypeError(`not a MemeCharge: ${JSON.stringify(value)}`);
}

/** The admissibility meet: worst obstruction wins. */
export function meetAdmissibility(a: MemeCharge, b: MemeCharge): MemeCharge {
  return RANK[a]! <= RANK[b]! ? a : b;
}

/** Fold independent charges to one composite verdict under the admissibility chain. */
export function foldCharges(values: Iterable<MemeCharge>): MemeCharge {
  let acc: MemeCharge = "potential";
  for (const v of values) acc = meetAdmissibility(acc, v);
  return acc;
}

/** A process is admitted exactly when its composite charge is potential. */
export function isAdmitted(charge: MemeCharge): boolean {
  return charge === "potential";
}

export function createMemeChargeCarrier<State extends string>(
  points: Iterable<string>,
  states: readonly State[],
  valueAt: (point: string, state: State) => MemeCharge | null | undefined,
  options: { absent?: MemeCharge } = {},
): MemeChargeCarrier<State> {
  const frozenPoints = Object.freeze([...points]);
  const frozenStates = Object.freeze([...states]);
  const stateSet = new Set<string>(frozenStates);
  const absent = options.absent ?? "absurd";

  return Object.freeze({
    kind: "meme-charge.carrier" as const,
    points: frozenPoints,
    states: frozenStates,
    absent,
    at(point: string, state: State | string): MemeCharge {
      if (!stateSet.has(state)) return absent;
      return valueAt(point, state as State) ?? absent;
    },
  });
}
