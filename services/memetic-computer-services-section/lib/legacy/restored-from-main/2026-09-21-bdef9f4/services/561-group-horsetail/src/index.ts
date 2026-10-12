// index.ts — the Horsetail public API.
import { makeWorld as _makeWorld } from "./world.ts";
import type { World } from "./world.ts";
import { readAll } from "./reader.ts";
import { evaluate } from "./evaluator.ts";
import { loadStdlib } from "./stdlib.ts";
import type { Charge, MemeCharge } from "./charge.ts";
import { BOT, memeChargeOf } from "./charge.ts";
import type { Form } from "./types.ts";

export type { Form } from "./types.ts";
export { sym, chargeLit, cell } from "./types.ts";
export type { Charge } from "./charge.ts";
export {
  T, F, BOT, TOP,
  isTop, isBottom, isAffirmed, isDenied, isHeld, isPending,
  negate, conflate,
  joinKnowledge, meetKnowledge, joinTruth, meetTruth,
  bottom, potential, memeChargeOf,
  seqOf, seqFrom, fnCharge, fnId, codeOf, codeFrom,
  valueOf, writeCharge, chargeBoolean,
} from "./charge.ts";
export { read, readAll, write } from "./reader.ts";
export { matchForm } from "./pattern.ts";
export type { MatchResult } from "./pattern.ts";
export type { World, FnDef, NativeDef, MacroDef, AnyDef, Env } from "./world.ts";
export { makeWorld as _makeWorld, gensym, parseParams } from "./world.ts";
export { evaluate } from "./evaluator.ts";
export { loadStdlib } from "./stdlib.ts";
export { readJson, chargeFromJson, chargeToJson } from "./json.ts";

// ── the Belnap reading ────────────────────────────────────────────────────────
// The MPU names the four points potential / active / absurd / stable. The rest of the computer —
// tsander's engine, the eavt substrate, metrologic — names them t / f / ⊥ / ⊤. They are two
// readings of the same two bits, and this is the one place the vocabularies are allowed to meet.
export type Four = "t" | "f" | "bot" | "top";

const FOUR_OF_MEME: Readonly<Record<MemeCharge, Four>> = {
  potential: "t",   // [T,F] affirmed
  active: "f",      // [F,T] denied
  absurd: "bot",    // [F,F] no information
  stable: "top",    // [T,T] held contradiction
};

const GLYPH_OF_FOUR: Readonly<Record<Four, string>> = { t: "t", f: "f", bot: "\u22a5", top: "\u22a4" };

/** The four-valued reading of a charge under Belnap's names. */
export function fourName(c: Charge): Four {
  return FOUR_OF_MEME[memeChargeOf(c)];
}

/** The display glyph for a charge (t / f / ⊥ / ⊤). Presentation only. */
export function glyph(c: Charge): string {
  return GLYPH_OF_FOUR[fourName(c)];
}

export const LANGUAGE_NAME = "Horsetail";

// ── high-level API ────────────────────────────────────────────────────────────

/** Create a fresh World with the stdlib preloaded. */
export function world(): World {
  const w = _makeWorld();
  loadStdlib(w);
  return w;
}

/** Read all forms from `src`, evaluate each in `w`, return the last Charge. */
export function run(src: string, w: World): Charge {
  const forms = readAll(src);
  if (forms.length === 0) return BOT;
  let result: Charge = BOT;
  for (const f of forms) result = evaluate(f, w.env, w);
  return result;
}

/** Run one source string, return a step object with the raw charge and its MemeCharge reading. */
export interface Step {
  readonly charge: Charge;
  readonly memeCharge: MemeCharge;
  readonly world: World;
}

export function step(src: string, w: World): Step {
  const charge = run(src, w);
  return { charge, memeCharge: memeChargeOf(charge), world: w };
}
