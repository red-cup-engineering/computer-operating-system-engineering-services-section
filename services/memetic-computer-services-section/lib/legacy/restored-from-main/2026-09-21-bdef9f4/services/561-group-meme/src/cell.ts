/** Cell (predication cell): a relational address subject —predicate→ object over Φ = E × Π × E.
 * The identity of a meme — what it is about, not what is said about it. */
export interface Cell {
  readonly subject: unknown;
  readonly predicate: unknown;
  readonly object: unknown;
}

/** A directed edge in a base category (specialization, converse, or projection). */
export interface Edge {
  readonly source: unknown;
  readonly target: unknown;
}

/** A set of entities — the E dimension of Φ = E × Π × E. */
export interface EntitySet {
  readonly entities: readonly unknown[];
}

/** A set of predicates — the Π dimension of Φ = E × Π × E. */
export interface PredicateSet {
  readonly predicates: readonly unknown[];
}

/** A cell-set: the E and Π dimensions together, defining the domain Φ. */
export interface CellSet {
  readonly "entity-set": EntitySet;
  readonly "predicate-set": PredicateSet;
}

/** The base category: the object set and its four morphism slots (specialization, converse, subject-projection, object-projection). */
export interface BaseCategory {
  readonly objects: unknown;
  readonly specialization: readonly Edge[];
  readonly converse: readonly Edge[];
  readonly "subject-projection": readonly Edge[];
  readonly "object-projection": readonly Edge[];
}

export const isCell = (x: unknown): x is Cell =>
  typeof x === "object" &&
  x !== null &&
  "subject" in x &&
  "predicate" in x &&
  "object" in x;
