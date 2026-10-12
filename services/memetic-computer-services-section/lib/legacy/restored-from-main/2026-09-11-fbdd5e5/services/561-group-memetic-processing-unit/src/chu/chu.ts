// chu.ts — a Chu space over the four-valued bilattice: a relation as a carrier with a duality.
//
// A Chu space C = (A, r, X) is a relation r : A × X → FOUR valued in FOUR. The points A are the rows,
// the states X the columns. Reading the matrix one way gives a point's costate; the other gives a
// state's extension. Over FOUR — self-dual under `negate` — the transpose-and-negate dual is exactly
// linear-logic / *-autonomous negation.
import { FOUR, asFour, negate, knowledgeJoin, type Four } from "./four.ts";

/** A Chu space over FOUR. */
export interface ChuSpace {
  readonly kind: "chu.space";
  readonly points: readonly string[];
  readonly states: readonly string[];
  readonly absent: Four;
  at(point: string, state: string): Four;
}

export interface ChuCell    { readonly state: string; readonly value: Four; }
export interface ChuCoCell  { readonly point: string; readonly value: Four; }

/** Build a Chu space from a value function.  Cells unknown to `valueAt` read as `absent`
 * (default FOUR.F — closed-world; pass FOUR.BOT for open-world / EAVT memory). */
export function chuSpace(
  points: Iterable<string>,
  states: Iterable<string>,
  valueAt: (point: string, state: string) => Four | null | undefined,
  options: { absent?: Four } = {},
): ChuSpace {
  const P = Object.freeze([...points]);
  const X = Object.freeze([...states]);
  const stateSet = new Set(X);
  const absent = asFour(options.absent ?? FOUR.F);
  return Object.freeze({
    kind: "chu.space" as const,
    points: P,
    states: X,
    absent,
    at(point: string, state: string): Four {
      if (!stateSet.has(state)) return absent;
      const v = valueAt(point, state);
      return v == null ? absent : asFour(v);
    },
  });
}

/** Build a Chu space from an explicit `{ [point]: { [state]: Four } }` matrix. */
export function fromMatrix(
  points: Iterable<string>,
  states: Iterable<string>,
  matrix: Record<string, Record<string, Four>>,
  options: { absent?: Four } = {},
): ChuSpace {
  return chuSpace(points, states, (p, x) => matrix?.[p]?.[x], options);
}

// ── the two reads ──────────────────────────────────────────────────────────────

/** A point's costate: its value across every state (a row). */
export function row(space: ChuSpace, point: string): ChuCell[] {
  return space.states.map((state) => ({ state, value: space.at(point, state) }));
}

/** A state's extension-with-values: every point's value on it (a column). */
export function col(space: ChuSpace, state: string): ChuCoCell[] {
  return space.points.map((point) => ({ point, value: space.at(point, state) }));
}

/** The positive extension of a state: the points whose value is `t`. */
export function extension(space: ChuSpace, state: string): string[] {
  return col(space, state).filter((cell) => cell.value === FOUR.T).map((cell) => cell.point);
}

// ── the duality ────────────────────────────────────────────────────────────────

/** Transpose: swap points and states, transpose the matrix.  `transpose ∘ transpose = id`. */
export function transpose(space: ChuSpace): ChuSpace {
  return chuSpace(space.states, space.points, (state, point) => space.at(point, state), { absent: space.absent });
}

/** The *-autonomous dual: transpose AND negate every cell.  `dual ∘ dual = id`. */
export function dual(space: ChuSpace): ChuSpace {
  return chuSpace(
    space.states,
    space.points,
    (state, point) => negate(space.at(point, state)),
    { absent: negate(space.absent) },
  );
}

// ── settling a line ────────────────────────────────────────────────────────────

/** Fold a column to one value through a bilattice join (default knowledge-join ⊕, identity ⊥). */
export function settleColumn(
  space: ChuSpace,
  state: string,
  join: (a: Four, b: Four) => Four = knowledgeJoin,
  identity: Four = FOUR.BOT,
): Four {
  return col(space, state).reduce((acc, cell) => join(acc, cell.value), asFour(identity));
}

/** Fold a row to one value through a bilattice join (default knowledge-join ⊕, identity ⊥). */
export function settleRow(
  space: ChuSpace,
  point: string,
  join: (a: Four, b: Four) => Four = knowledgeJoin,
  identity: Four = FOUR.BOT,
): Four {
  return row(space, point).reduce((acc, cell) => join(acc, cell.value), asFour(identity));
}

/** Is `value` a Chu space built by this module? */
export function isChuSpace(value: unknown): value is ChuSpace {
  return !!value && typeof value === "object" && (value as ChuSpace).kind === "chu.space";
}
