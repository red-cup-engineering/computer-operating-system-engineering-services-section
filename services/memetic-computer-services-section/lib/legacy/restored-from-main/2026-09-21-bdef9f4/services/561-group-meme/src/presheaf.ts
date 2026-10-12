import type { EntitySet, BaseCategory } from "./cell.ts";
import type { Fiber, FiberAlgebra, Valuation, Trace } from "./fiber.ts";

/** PositPresheaf: the valued presheaf that posit builds — the classical-spacetime structure.
 * Each cell now bears a definite charge (seeded at absurd / knowledge-least); the superposition
 * has collapsed. Posit is collapsing: the quantum → classical boundary in one generator. */
export interface PositPresheaf {
  readonly fiber: Fiber;
  readonly base: BaseCategory;
  readonly "entity-set": EntitySet;
  readonly fibers: readonly FiberAlgebra[];
}

/** Posited: the PositPresheaf together with the (yet-unsettled) traces — the full output of posit,
 * ready to be driven through settle. */
export interface Posited {
  readonly presheaf: PositPresheaf;
  readonly traces: readonly Trace[];
}

/** Sheaf: the glued settled structure — the base category and the settled section (a valuation at
 * the knowledge-least fixed point). The output of settle; H¹ = 0 here. */
export interface Sheaf {
  readonly base: BaseCategory;
  readonly section: Valuation;
}
