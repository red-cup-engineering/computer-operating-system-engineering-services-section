

import { isCell } from "./cell.mjs";
import { isCharge } from "./charge.mjs";

/** Meme: the irreducible thing-with-evidence — a cell (its relational identity) paired with its
 * charge (its four-valued word). The unit the Memetic Processing Unit processes and the Memetic
 * Memory Unit stores. The tail of the descent: what settles out of articulate → predicate → posit → settle. */

export const isMeme = (x) =>
  typeof x === "object" &&
  x !== null &&
  "cell" in x &&
  "charge" in x &&
  isCell((x).cell) &&
  isCharge((x).charge);
