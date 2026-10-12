// primitives
export type { Token, Claim, Utterance, Bit } from "./primitives.ts";
export { isBit } from "./primitives.ts";

// cell
export type { Cell, Edge, EntitySet, PredicateSet, CellSet, BaseCategory } from "./cell.ts";
export { isCell } from "./cell.ts";

// charge
export type { Charge } from "./charge.ts";
export { isCharge } from "./charge.ts";

// meme
export type { Meme } from "./meme.ts";
export { isMeme } from "./meme.ts";

// fiber
export type { Fiber, FiberAlgebra, Valuation, Trace } from "./fiber.ts";

// presheaf
export type { PositPresheaf, Posited, Sheaf } from "./presheaf.ts";

// morphisms
export type { Predicated, Articulate, Predicate, Posit, Settle } from "./morphisms.ts";
