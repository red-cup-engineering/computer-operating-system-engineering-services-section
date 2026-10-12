// charge.ts — re-exports the MPU's charge algebra and adds Horsetail-specific data carriers:
// sequence, function-reference, and homoiconic code — all encoded as Charge evidence.
export type { Charge, ChargePair } from "@561-group/memetic-processing-unit/charge";
export {
  present, isTop, isBottom, negate, conflate,
  joinKnowledge, meetKnowledge, joinTruth, meetTruth,
  leqKnowledge, aggregate, bottom, potential,
} from "@561-group/memetic-processing-unit/charge";
export type { MemeCharge } from "@561-group/memetics";

import type { Charge } from "@561-group/memetic-processing-unit/charge";
import { isTop, isBottom } from "@561-group/memetic-processing-unit/charge";
import type { MemeCharge } from "@561-group/memetics";
import type { Form } from "./types.ts";

// ── canonical charge points ──────────────────────────────────────────────────

/** potential [T,F] — affirmed, no contradiction */
export const T: Charge = { value: [true, false], evidence: [[], []] };
/** active [F,T] — denied */
export const F: Charge = { value: [false, true], evidence: [[], []] };
/** absurd [F,F] — no information */
export const BOT: Charge = { value: [false, false], evidence: [[], []] };
/** stable [T,T] — held contradiction */
export const TOP: Charge = { value: [true, true], evidence: [[], []] };

// ── boolean projections ───────────────────────────────────────────────────────

/** Strictly potential [T,F] → true; everything else (including ⊤) → false. Edge-only collapse. */
export const chargeBoolean = (c: Charge): boolean => c.value[0] && !c.value[1];

/** Has a positive mark: t or ⊤. */
export const isAffirmed = (c: Charge): boolean => c.value[0];

/** Has a negative mark: f or ⊤. */
export const isDenied = (c: Charge): boolean => c.value[1];

/** Alias for isTop — held contradiction ⊤. */
export const isHeld = isTop;

/** Alias for isBottom — pending / no-information ⊥. */
export const isPending = isBottom;

/** Read a raw charge as the memetics-level MemeCharge. */
export function memeChargeOf(c: Pick<Charge, "value">): MemeCharge {
  const [positive, negative] = c.value;
  return positive && negative ? "stable" : positive ? "potential" : negative ? "active" : "absurd";
}

// ── data carriers ─────────────────────────────────────────────────────────────
// Every Horsetail value is a Charge. Structured values (seq, fn, code) are encoded
// as tagged objects in the first positive-evidence slot.

// Sequence ────────────────────────────────────────────────────────────────────

type SeqData = { readonly seq: readonly Charge[] };

const isSeqData = (v: unknown): v is SeqData =>
  typeof v === "object" && v !== null &&
  "seq" in (v as object) && Array.isArray((v as SeqData).seq);

export const seqOf = (items: readonly Charge[]): Charge => ({
  value: [true, false],
  evidence: [[{ seq: items }], []],
});

export const seqFrom = (c: Charge): readonly Charge[] | null => {
  const v = c.evidence[0][0];
  return isSeqData(v) ? v.seq : null;
};

// Function reference ──────────────────────────────────────────────────────────

type FnData = { readonly fn: string };

const isFnData = (v: unknown): v is FnData =>
  typeof v === "object" && v !== null &&
  "fn" in (v as object) && typeof (v as FnData).fn === "string";

export const fnCharge = (id: string): Charge => ({
  value: [true, false],
  evidence: [[{ fn: id }], []],
});

export const fnId = (c: Charge): string | null => {
  const v = c.evidence[0][0];
  return isFnData(v) ? v.fn : null;
};

// Homoiconic code ─────────────────────────────────────────────────────────────

type CodeData = { readonly __form: Form };

const isCodeData = (v: unknown): v is CodeData =>
  typeof v === "object" && v !== null && "__form" in (v as object);

export const codeOf = (form: Form): Charge => ({
  value: [true, false],
  evidence: [[{ __form: form }], []],
});

export const codeFrom = (c: Charge): Form | null => {
  const v = c.evidence[0][0];
  return isCodeData(v) ? v.__form : null;
};

// ── raw value extraction ──────────────────────────────────────────────────────

/** Extract the first positive witness as a raw JS value — the payload for numbers and strings. */
export const valueOf = (c: Charge): unknown => c.evidence[0][0] ?? null;

// ── display ───────────────────────────────────────────────────────────────────

/** Pretty-print a charge as a Horsetail value string. */
export function writeCharge(c: Charge): string {
  const [pos, neg] = c.value;
  if (pos && neg) return "⊤";
  if (!pos && !neg) return "⊥";
  if (neg) return "f";

  const v = valueOf(c);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return `"${v}"`;
  if (v !== null && typeof v === "object") {
    if (isSeqData(v)) {
      const items = seqFrom(c);
      return items ? `(seq${items.map((x) => " " + writeCharge(x)).join("")})` : "#<seq>";
    }
    if (isFnData(v)) return "#<fn>";
    if (isCodeData(v)) return "#<code>";
  }
  if (v === null || v === undefined) return "t";
  return `#<${String(v)}>`;
}
