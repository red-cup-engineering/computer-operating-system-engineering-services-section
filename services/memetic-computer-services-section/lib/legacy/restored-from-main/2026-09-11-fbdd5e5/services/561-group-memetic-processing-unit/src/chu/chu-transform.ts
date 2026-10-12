// chu-transform.ts — Chu transforms: the morphisms of Chu(FOUR), making the spaces a category.
//
// A morphism from C=(A,r,X) to D=(B,s,Y) is an adjoint pair (f, g):
//     f : A → B   (forward, on points — covariant)
//     g : Y → X   (backward, on states — CONTRAVARIANT)
// satisfying: s(f a, y) = r(a, g y)  for all a ∈ A, y ∈ Y.
// The backward leg is the whole point: a view pushes points forward but pulls observations back.
import { asFour, type Four } from "./four.ts";
import { dual, type ChuSpace } from "./chu.ts";

export type ChuForward  = (point: string) => string;
export type ChuBackward = (state: string) => string;

export type ChuFailure =
  | { kind: "domain"; point?: string; state?: string; mapped: string; why: string }
  | { kind: "adjointness"; point: string; state: string; left: Four; right: Four };

export interface ChuCheckResult { ok: boolean; failures: ChuFailure[]; }

/** A morphism of Chu spaces C → D: an adjoint pair (forward, backward). */
export interface ChuTransform {
  readonly kind: "chu.transform";
  readonly label: string | null;
  readonly source: ChuSpace;
  readonly target: ChuSpace;
  forward(point: string): string;
  backward(state: string): string;
}

/** Check the adjoint pair (forward, backward) : source → target.  Returns every failing cell. */
export function checkChuTransform(
  source: ChuSpace, target: ChuSpace,
  forward: ChuForward, backward: ChuBackward,
): ChuCheckResult {
  const failures: ChuFailure[] = [];
  const targetPoints = new Set(target.points);
  const sourceStates = new Set(source.states);

  for (const a of source.points) {
    const fa = forward(a);
    if (!targetPoints.has(fa)) failures.push({ kind: "domain", point: a, mapped: fa, why: "forward left target.points" });
  }
  for (const y of target.states) {
    const gy = backward(y);
    if (!sourceStates.has(gy)) failures.push({ kind: "domain", state: y, mapped: gy, why: "backward left source.states" });
  }
  if (failures.length) return { ok: false, failures };

  for (const a of source.points) {
    for (const y of target.states) {
      const left  = asFour(target.at(forward(a), y));   // s(f a, y)
      const right = asFour(source.at(a, backward(y)));  // r(a, g y)
      if (left !== right) failures.push({ kind: "adjointness", point: a, state: y, left, right });
    }
  }
  return { ok: failures.length === 0, failures };
}

/** Construct a morphism C → D.  THROWS if the pair is not adjoint. */
export function chuTransform(
  source: ChuSpace, target: ChuSpace,
  forward: ChuForward, backward: ChuBackward,
  options: { label?: string } = {},
): ChuTransform {
  const check = checkChuTransform(source, target, forward, backward);
  if (!check.ok) {
    const first = check.failures[0];
    throw new Error(`not a Chu transform (${check.failures.length} violation(s)); first: ${JSON.stringify(first)}`);
  }
  return Object.freeze({ kind: "chu.transform" as const, label: options.label ?? null, source, target, forward, backward });
}

/** Is `value` a Chu transform built by this module? */
export function isChuTransform(value: unknown): value is ChuTransform {
  return !!value && typeof value === "object" && (value as ChuTransform).kind === "chu.transform";
}

/** The identity morphism on a space (trivially adjoint). */
export function idTransform(space: ChuSpace, options: { label?: string } = {}): ChuTransform {
  return chuTransform(space, space, (a) => a, (y) => y, { label: options.label ?? "id" });
}

/** Compose t1 : C → D with t2 : D → E.  Points run forward through both; states pull back in reverse. */
export function composeTransforms(t1: ChuTransform, t2: ChuTransform, options: { label?: string } = {}): ChuTransform {
  if (t1.target !== t2.source) {
    throw new Error("composeTransforms: t1.target must be t2.source");
  }
  return chuTransform(
    t1.source, t2.target,
    (a) => t2.forward(t1.forward(a)),
    (z) => t1.backward(t2.backward(z)),
    { label: options.label ?? `${t2.label ?? "·"}∘${t1.label ?? "·"}` },
  );
}

/** The dual functor on morphisms: (f, g) : C → D dualizes to (g, f) : D^⊥ → C^⊥. */
export function dualTransform(t: ChuTransform, options: { label?: string } = {}): ChuTransform {
  return chuTransform(
    dual(t.target), dual(t.source),
    t.backward, t.forward,
    { label: options.label ?? `(${t.label ?? "·"})^⊥` },
  );
}
