/** Cell (predication cell): a relational address subject —predicate→ object over Φ = E × Π × E.
 * The identity of a meme — what it is about, not what is said about it. */

/** A directed edge in a base category (specialization, converse, or projection). */

/** A set of entities — the E dimension of Φ = E × Π × E. */

/** A set of predicates — the Π dimension of Φ = E × Π × E. */

/** A cell-set: the E and Π dimensions together, defining the domain Φ. */

/** The base category: the object set and its four morphism slots (specialization, converse, subject-projection, object-projection). */

export const isCell = (x) =>
  typeof x === "object" &&
  x !== null &&
  "subject" in x &&
  "predicate" in x &&
  "object" in x;
