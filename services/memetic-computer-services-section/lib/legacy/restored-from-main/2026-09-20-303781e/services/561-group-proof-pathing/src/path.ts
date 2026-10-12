// path.ts — render a witnessed route to a typed POSIX path, and parse one back. The format is the mm /
// grow.mjs convention: `root/<generator>/library/<term>/<generator>/library/<term>/…`. Each `/library/`
// segment is the term a generator lands on; the bare generator segment names the morphism taken. The whole
// string is a checkable Curry-Howard proof term: walking it re-derives the route (foundation → target).
import { type Term, segment, desanitizeSegment } from "./term.ts";
import { type Generator, type Route, MORPHISM_KEYS } from "./category.ts";

const isGenerator = (value: string): value is Generator => (MORPHISM_KEYS as readonly string[]).includes(value);

/** Render a route to its typed path. The root is the foundational term; each step adds `/<kind>/library/<node>`. */
export function render(route: Route): string {
  let path = segment(route.root);
  for (const step of route.steps) path += `/${step.kind}/library/${segment(step.node)}`;
  return path;
}

/** A parsed path: the root key and the (kind, node-key) hops — keys are the desanitized term keys, so a
 * parsed path compares to a structure's terms by `termKey` without reconstructing the original values. */
export interface ParsedPath {
  readonly rootKey: string;
  readonly steps: readonly { readonly kind: Generator; readonly nodeKey: string }[];
}

/** Parse a typed path back into its root and hops; null if it is not a well-formed proof path. */
export function parsePath(path: string): ParsedPath | null {
  const parts = path.split("/");
  if (parts.length === 0 || parts[0] === undefined || parts[0] === "") return null;
  const rootKey = desanitizeSegment(parts[0]);
  const steps: { kind: Generator; nodeKey: string }[] = [];
  for (let i = 1; i < parts.length; i += 3) {
    const kind = parts[i];
    const library = parts[i + 1];
    const node = parts[i + 2];
    if (kind === undefined || node === undefined || library !== "library" || !isGenerator(kind)) return null;
    steps.push({ kind, nodeKey: desanitizeSegment(node) });
  }
  return { rootKey, steps };
}

/** The target term-key a route proves (the last hop's node, or the root if there are no hops). */
export const targetKeyOf = (path: ParsedPath): string =>
  path.steps.length === 0 ? path.rootKey : path.steps[path.steps.length - 1]!.nodeKey;

export type { Term };
