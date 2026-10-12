// structure-path.ts — direct fold from a math-style morphism-slot structure to
// the typed proof path. This is the compatibility-by-capability bridge for the
// old mm/term-memory `pathOf`: it reads generator names from the structure's
// own keys, then delegates reachability and rendering to the proof engine.
import { type Atom, type Generator, MORPHISM_KEYS } from "./category.ts";
import { prove } from "./prove.ts";
import type { Term } from "./term.ts";

export type MorphismEdge = Readonly<{
  domain: Term;
  codomain: Term;
}>;

export type MorphismSlotStructure = Readonly<{
  [key: string]: unknown;
}>;

export function atomsOfStructure(structure: MorphismSlotStructure): readonly Atom[] {
  const atoms: Atom[] = [];
  for (const kind of MORPHISM_KEYS) {
    const edges = structure[kind];
    if (!Array.isArray(edges)) continue;
    for (const edge of edges) {
      if (!isMorphismEdge(edge)) continue;
      atoms.push({ subject: edge.domain, predicate: kind, object: edge.codomain });
    }
  }
  return Object.freeze(atoms);
}

export function pathOf(structure: MorphismSlotStructure, root: Term, target: Term): string | null {
  return prove(atomsOfStructure(structure), root, target).path;
}

export const pathOfStructure = pathOf;

function isMorphismEdge(value: unknown): value is MorphismEdge {
  return value !== null
    && typeof value === "object"
    && "domain" in value
    && "codomain" in value;
}

export type { Generator };
