import type { CellSet, EntitySet, BaseCategory } from "./cell.ts";
import type { Meme } from "./meme.ts";

/** Fiber: the cell-set and base category for a single predicate's domain — the structural scaffold
 * that predicate builds before charges are seeded. */
export interface Fiber {
  readonly "cell-set": CellSet;
  readonly base: BaseCategory;
  readonly "entity-set": EntitySet;
}

/** FiberAlgebra (settlement fiber): the charged assignments over a single predicate's E × E square.
 * Each assignment is a meme — a cell with its measured charge. The per-predicate component of the
 * settled valuation; settle iterates these to their knowledge-least fixed point. */
export interface FiberAlgebra {
  readonly "entity-set": EntitySet;
  readonly assignments: readonly Meme[];
  readonly predicate: unknown;
}

/** Valuation: the base category plus the charged fiber-algebras — the state of the knowledge closure
 * at one step of settling. */
export interface Valuation {
  readonly base: BaseCategory;
  readonly "fiber-algebras": readonly FiberAlgebra[];
}

/** Trace: the sequence of valuations produced by one pass of the settling closure. */
export interface Trace {
  readonly valuations: readonly Valuation[];
}
