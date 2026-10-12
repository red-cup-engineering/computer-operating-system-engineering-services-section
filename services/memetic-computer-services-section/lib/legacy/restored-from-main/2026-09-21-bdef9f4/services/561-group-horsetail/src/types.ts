// types.ts — the Horsetail AST: the Form vocabulary that the reader produces and the evaluator consumes.
// All variants are discriminated by a `kind` field so TypeScript can narrow without typeof checks.
// No runtime dependency — all imports are type-only.
import type { Charge } from "@561-group/memetic-processing-unit/charge";

/** A symbol reference: a name that resolves to a value via lexical scope. */
export interface Sym {
  readonly kind: "sym";
  readonly name: string;
}

/** A charge literal — self-evaluating: t [T,F], f [F,T], ⊥ [F,F], ⊤ [T,T]. */
export interface ChargeLit {
  readonly kind: "charge-lit";
  readonly charge: Charge;
}

/** A cell (parenthesized list): `(head arg…)` or `()`. */
export interface HCell {
  readonly kind: "cell";
  readonly items: readonly Form[];
}

/** A numeric literal — self-evaluating. */
export interface Num {
  readonly kind: "num";
  readonly value: number;
}

/** A string literal — self-evaluating. */
export interface Str {
  readonly kind: "str";
  readonly value: string;
}

/** Any syntactic form. Every variant has a `kind` discriminant for exhaustive narrowing. */
export type Form = Sym | ChargeLit | HCell | Num | Str;

// ── constructors ──────────────────────────────────────────────────────────────

export const sym = (name: string): Sym => ({ kind: "sym", name });
export const chargeLit = (charge: Charge): ChargeLit => ({ kind: "charge-lit", charge });
export const cell = (items: readonly Form[]): HCell => ({ kind: "cell", items });
export const num = (value: number): Num => ({ kind: "num", value });
export const str = (value: string): Str => ({ kind: "str", value });
