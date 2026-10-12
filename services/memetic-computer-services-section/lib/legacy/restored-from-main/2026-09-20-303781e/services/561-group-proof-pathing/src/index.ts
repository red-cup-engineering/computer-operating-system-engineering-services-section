// index.ts — proof-pathing: the Meme-structure → typed-path fold, read through Curry-Howard-Lambek.
//
// A path is a PROOF. `structureOf` folds a knowledge base of cells into the predicate category's atomic
// generator edges (specialization, converse, subject-/object-projection). `prove` composes them — the LFP
// of the path-composition monad (`saturate`/μ, reused from the MPU) is the proof's existence (Lambek's
// initial algebra), a witnessing BFS route its concrete terms — and `render`s the route to a typed POSIX
// path `root/<generator>/library/<term>/…`. The generator sequence IS the proof term; the path is its own
// collision-free index (Yoneda); `walk` re-checks it. The only data dependency is `@561-group/meme`.

// terms + segment encoding
export type { Term, Cell } from "./term.ts";
export { termKey, segment, sanitizeSegment, desanitizeSegment, cellOf } from "./term.ts";

// the predicate category: generators + the structure builder
export type { Generator, Atom, Step, Route, StructureOptions } from "./category.ts";
export { MORPHISM_KEYS, structureOf } from "./category.ts";
export type { MorphismEdge, MorphismSlotStructure } from "./structure-path.ts";
export { atomsOfStructure, pathOf, pathOfStructure } from "./structure-path.ts";

// the least-fixed-point ascent
export { ascend } from "./ascend.ts";

// rendering / parsing typed paths
export type { ParsedPath } from "./path.ts";
export { render, parsePath, targetKeyOf } from "./path.ts";

// typed term coordinates
export type { AddressTerm } from "./address.ts";
export {
  address,
  logPath,
  termOf,
  addressNested,
  termOfNested,
  composeTerm,
  decomposeTerm,
  namespaceOf,
  withinNamespace,
} from "./address.ts";

// proof construction
export type { Proof, WalkResult } from "./prove.ts";
export { closure, proves, routeOf, prove, walk } from "./prove.ts";
