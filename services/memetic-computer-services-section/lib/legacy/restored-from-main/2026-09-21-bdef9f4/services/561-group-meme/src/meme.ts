import type { Cell } from "./cell.ts";
import type { Charge } from "./charge.ts";
import { isCell } from "./cell.ts";
import { isCharge } from "./charge.ts";

/** Meme: the irreducible thing-with-evidence — a cell (its relational identity) paired with its
 * charge (its four-valued word). The unit the Memetic Processing Unit processes and the Memetic
 * Memory Unit stores. The tail of the descent: what settles out of articulate → predicate → posit → settle. */
export interface Meme {
  readonly cell: Cell;
  readonly charge: Charge;
}

export const isMeme = (x: unknown): x is Meme =>
  typeof x === "object" &&
  x !== null &&
  "cell" in x &&
  "charge" in x &&
  isCell((x as Meme).cell) &&
  isCharge((x as Meme).charge);
