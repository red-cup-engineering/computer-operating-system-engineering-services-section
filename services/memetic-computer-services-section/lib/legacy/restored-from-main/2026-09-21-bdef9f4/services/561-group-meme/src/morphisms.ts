// The descent pipeline: articulate → predicate → posit → settle.
// TypeScript function-type signatures for each morphism; no runtime implementation here.
// These type the descent purely as a sequence of transformations between the schema types.
import type { Utterance, Bit } from "./primitives.ts";
import type { CellSet } from "./cell.ts";
import type { Fiber } from "./fiber.ts";
import type { PositPresheaf, Posited, Sheaf } from "./presheaf.ts";

/** Predicated: the intermediate state between predicate and posit — the utterance read as
 * E × Π × E, with the cell-set and base fiber built but no charges seeded yet. */
export interface Predicated {
  readonly "cell-set": CellSet;
  readonly fiber: Fiber;
}

/** Articulate: draw a distinction — take an utterance and produce a freshly marked bit (both slots empty, absurd). */
export type Articulate = (utterance: Utterance) => Bit;

/** Predicate: read the bit as E × Π × E — build the cell-set and base fiber from the token (entity)
 * and claim (predicate dimension). The residue (the claim) becomes the predicate axis; it never closes here. */
export type Predicate = (bit: Bit) => Predicated;

/** Posit: seed knowledge — build the PositPresheaf by seeding every cell in Φ to the knowledge-least
 * charge (absurd / ⊥), and compute the initial traces. This is collapsing: the first definite charge. */
export type Posit = (predicated: Predicated) => Posited;

/** Settle: iterate the knowledge closure to its least fixed point — glue the presheaf into a sheaf.
 * The output carries the settled section: every cell's charge at equilibrium. */
export type Settle = (posited: Posited) => Sheaf;
