// prove.ts — the proof construction. A proof that `target` is reachable from `root` is a composite of
// generator morphisms. CLOSURE is the authoritative reachability: `saturate` (the MPU path monad's μ —
// `(a,p,b)·(b,q,c)↦(a,[p,q],c)`) driven to its least fixed point by `ascend` (Kleene/Knaster–Tarski) is
// the initial algebra of the closure operator (Lambek) — the transitive closure of the generator graph.
// ROUTE is a witness for it: a BFS that retains the intermediate terms, so the proof can be RENDERED to a
// typed path. `walk` re-checks a rendered path against the structure — the proof term is checkable.
import { saturate, type PathEdge, type PathPotential } from "@561-group/memetic-processing-unit/void";
import { ascend } from "./ascend.ts";
import { type Atom, type Generator, type Route, type Step } from "./category.ts";
import { type Term, termKey } from "./term.ts";
import { render, parsePath } from "./path.ts";

// ── the path-composition monad's least fixed point ──────────────────────────────────────────────────

const labelKey = (predicate: unknown): string => (Array.isArray(predicate) ? predicate.map(String).join(",") : String(predicate));
const edgeKey = (edge: PathEdge): string => `${termKey(edge.subject)}|${labelKey(edge.predicate)}|${termKey(edge.object)}`;

const dedupe = (edges: readonly PathEdge[]): PathEdge[] => {
  const seen = new Set<string>();
  const out: PathEdge[] = [];
  for (const edge of edges) {
    const key = edgeKey(edge);
    if (!seen.has(key)) { seen.add(key); out.push(edge); }
  }
  return out;
};

const potentialKey = (potential: PathPotential): string => [...new Set(potential.potential.map(edgeKey))].sort().join("\n");

/** closure(atoms) — the transitive closure of the generator graph: `saturate` to its least fixed point.
 * Each composite edge carries its accumulated generator sequence (its proof term). */
export function closure(atoms: readonly Atom[]): readonly PathEdge[] {
  const step = (potential: PathPotential): PathPotential => ({ potential: dedupe(saturate(potential).potential) });
  return ascend(step, { potential: dedupe(atoms) }, potentialKey).value.potential;
}

/** proves(atoms, root, target) — whether a proof exists, by the LFP closure (CHL reachability). */
export function proves(atoms: readonly Atom[], root: Term, target: Term): boolean {
  const rootK = termKey(root);
  const targetK = termKey(target);
  if (rootK === targetK) return true;
  return closure(atoms).some((edge) => termKey(edge.subject) === rootK && termKey(edge.object) === targetK);
}

// ── a witnessing route (retains the intermediate terms, for rendering) ──────────────────────────────

/** routeOf(atoms, root, target) — a shortest witnessing route (BFS over atomic edges), or null. A route
 * exists iff the LFP closure contains the composite — `routeOf` just keeps the terms `saturate` forgets. */
export function routeOf(atoms: readonly Atom[], root: Term, target: Term): Route | null {
  const rootK = termKey(root);
  const targetK = termKey(target);
  if (rootK === targetK) return { root, steps: [] };

  const adjacency = new Map<string, Atom[]>();
  for (const atom of atoms) {
    const key = termKey(atom.subject);
    let list = adjacency.get(key);
    if (!list) { list = []; adjacency.set(key, list); }
    list.push(atom);
  }

  const queue: { key: string; steps: Step[] }[] = [{ key: rootK, steps: [] }];
  const seen = new Set<string>([rootK]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const atom of adjacency.get(current.key) ?? []) {
      const objectK = termKey(atom.object);
      if (seen.has(objectK)) continue;
      const steps: Step[] = [...current.steps, { kind: atom.predicate, node: atom.object }];
      if (objectK === targetK) return { root, steps };
      seen.add(objectK);
      queue.push({ key: objectK, steps });
    }
  }
  return null;
}

// ── prove / walk ────────────────────────────────────────────────────────────────────────────────────

/** A proof: whether the target is reachable, the witnessing route, its generator sequence (the proof
 * term), and the rendered typed path. */
export interface Proof {
  readonly ok: boolean;
  readonly route: Route | null;
  readonly generators: readonly Generator[];
  readonly path: string | null;
}

/** prove(atoms, root, target) — the proof of `target` from `root`: reachability by the LFP closure, plus a
 * witnessing route rendered to a typed path. */
export function prove(atoms: readonly Atom[], root: Term, target: Term): Proof {
  if (!proves(atoms, root, target)) return { ok: false, route: null, generators: [], path: null };
  const route = routeOf(atoms, root, target);
  if (!route) return { ok: false, route: null, generators: [], path: null };
  return { ok: true, route, generators: route.steps.map((s) => s.kind), path: render(route) };
}

/** The result of checking a rendered path against a structure. */
export interface WalkResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/** walk(atoms, path) — re-check that a rendered path is a real proof: every hop must be an atomic
 * generator edge of the structure (the Curry-Howard proof term is checkable). */
export function walk(atoms: readonly Atom[], path: string): WalkResult {
  const parsed = parsePath(path);
  if (!parsed) return { ok: false, reason: "malformed proof path" };
  const edges = new Set(atoms.map((a) => `${termKey(a.subject)}|${a.predicate}|${termKey(a.object)}`));
  let currentKey = parsed.rootKey;
  for (const step of parsed.steps) {
    const key = `${currentKey}|${step.kind}|${step.nodeKey}`;
    if (!edges.has(key)) return { ok: false, reason: `no ${step.kind} edge from ${currentKey} to ${step.nodeKey}` };
    currentKey = step.nodeKey;
  }
  return { ok: true };
}
