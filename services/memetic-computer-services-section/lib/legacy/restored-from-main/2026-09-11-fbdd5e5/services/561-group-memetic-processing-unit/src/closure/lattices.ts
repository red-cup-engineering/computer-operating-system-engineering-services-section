// lattices.ts — closures whose ordinals exhibit each regime, so the morphism can be watched.
//
// Each export is a `{ lattice, phi }` pair ready for `closureOrdinal`. Three regime witnesses:
//   reachability  — finite κ < ω  (graph reachability from a seed)
//   omegaPlusOne  — κ = ω+1       (one non-Scott-continuous firing at the ω-limit)
//   tower         — no countable κ (every ω-block fires a fresh block — aperiodic)
//
// `fromBilattice` bridges the floor's `settle` to this morphism: shows settle is the finite-κ
// restriction of the general closure, and lets `closureOrdinal` recover settle's depth as κ.

import type { Posited, Valuation } from "@561-group/meme";
import { commutate, possibilizeKnowledge, necessitateKnowledge, lastValuation, settle } from "../descent.ts";
import { leqKnowledge, joinKnowledge } from "../charge.ts";
import { stabilizingSup, type Lattice } from "./iterate.ts";

const S = (x: unknown) => JSON.stringify(x);
const uniqSort = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

// ── finite closure: κ < ω ─────────────────────────────────────────────────────

export function reachability(
  nVertices: number,
  edges: readonly [number, number][],
  seed: number[] = [0],
): { lattice: Lattice<number[]>; phi: (s: number[]) => number[] } {
  const lattice: Lattice<number[]> = {
    bottom: uniqSort(seed),
    leq: (a, b) => a.every((x) => b.includes(x)),
    join: (a, b) => uniqSort([...a, ...b]),
    eq: (a, b) => S(a) === S(b),
    sup: stabilizingSup<number[]>({ eq: (a, b) => S(a) === S(b) }),
  };
  const phi = (s: number[]) =>
    uniqSort([...s, ...edges.filter(([u]) => s.includes(u)).map(([, v]) => v)]);
  return { lattice, phi };
}

// ── one non-Scott-continuous firing: κ = ω+1 ──────────────────────────────────

type OmegaElem = { tag: "finite"; set: number[] } | { tag: "nats" } | { tag: "all" };
const NATS: OmegaElem = { tag: "nats" };
const ALL: OmegaElem = { tag: "all" };
const Fin = (set: number[]): OmegaElem => ({ tag: "finite", set: uniqSort(set) });
const eqEl = (a: OmegaElem, b: OmegaElem) =>
  a.tag === b.tag && (a.tag !== "finite" || S((a as { tag: "finite"; set: number[] }).set) === S((b as { tag: "finite"; set: number[] }).set));

export function omegaPlusOne(): { lattice: Lattice<OmegaElem>; phi: (a: OmegaElem) => OmegaElem; rank: (a: OmegaElem) => number } {
  const join = (a: OmegaElem, b: OmegaElem): OmegaElem => {
    if (a.tag === "all" || b.tag === "all") return ALL;
    if (a.tag === "nats" || b.tag === "nats") return NATS;
    return Fin([...(a as { tag: "finite"; set: number[] }).set, ...(b as { tag: "finite"; set: number[] }).set]);
  };
  const lattice: Lattice<OmegaElem> = {
    bottom: Fin([]),
    join,
    eq: eqEl,
    leq: (a, b) => eqEl(join(a, b), b),
    sup: (seqFn) => {
      let prev = seqFn(0);
      for (let n = 1; n <= 64; n++) {
        const cur = seqFn(n);
        if (eqEl(cur, prev)) return cur;
        if (cur.tag !== "finite") return cur;
        prev = cur;
      }
      return NATS;
    },
  };
  const phi = (a: OmegaElem): OmegaElem => {
    if (a.tag === "all") return ALL;
    if (a.tag === "nats") return ALL;
    const s = (a as { tag: "finite"; set: number[] }).set;
    let m = 0; while (s.includes(m)) m++;
    return Fin([...s, m]);
  };
  return { lattice, phi, rank: (a) => a.tag === "all" ? 3 : a.tag === "nats" ? 2 : 1 };
}

// ── a never-stabilizing tower: no countable κ (aperiodic) ────────────────────

type TowerElem = { block: number; set: number[]; full: boolean };
const T = (block: number, set: number[], full = false): TowerElem => ({ block, set: uniqSort(set), full });
const eqT = (a: TowerElem, b: TowerElem) => a.block === b.block && a.full === b.full && S(a.set) === S(b.set);

export function tower(): { lattice: Lattice<TowerElem>; phi: (a: TowerElem) => TowerElem } {
  const lattice: Lattice<TowerElem> = {
    bottom: T(0, []),
    eq: eqT,
    join: (a, b) => a.block !== b.block ? (a.block > b.block ? a : b)
      : T(a.block, [...a.set, ...b.set], a.full || b.full),
    leq: (a, b) => a.block < b.block || (a.block === b.block && (b.full || !a.full) && a.set.every((x) => b.set.includes(x))),
    sup: (seqFn) => {
      let prev = seqFn(0);
      for (let n = 1; n <= 64; n++) {
        const cur = seqFn(n);
        if (eqT(cur, prev)) return cur;
        if (cur.block > prev.block || cur.full) return cur;
        prev = cur;
      }
      return T(prev.block, prev.set, true);
    },
  };
  const phi = (a: TowerElem): TowerElem => {
    if (a.full) return T(a.block + 1, [], false);
    let m = 0; while (a.set.includes(m)) m++;
    return T(a.block, [...a.set, m], false);
  };
  return { lattice, phi };
}

// ── the floor's settle as a (lattice, phi) pair ───────────────────────────────

const faAssignments = (v: Valuation) => v["fiber-algebras"].flatMap((fa) => fa.assignments);

export function fromBilattice(category: Posited): {
  lattice: Lattice<Valuation>;
  phi: (v: Valuation) => Valuation;
  settledValuation: Valuation;
} {
  const { saturated: presheaf, residue: traces } = commutate(category);
  const wrap = (v: Valuation): Posited => ({ presheaf, traces: [{ valuations: [v] }] });
  const bottom = traces[0]!.valuations[0]!;
  const phi = (v: Valuation): Valuation =>
    lastValuation(possibilizeKnowledge(necessitateKnowledge(wrap(v))));
  const lattice: Lattice<Valuation> = {
    bottom,
    eq: (a, b) => S(a) === S(b),
    leq: (a, b) => {
      const cb = faAssignments(b);
      return faAssignments(a).every((ca, i) => leqKnowledge(ca.charge, cb[i]!.charge));
    },
    join: (a, b) => ({
      ...a,
      "fiber-algebras": a["fiber-algebras"].map((fa, j) => ({
        ...fa,
        assignments: fa.assignments.map((asg, i) => ({
          cell: asg.cell,
          charge: joinKnowledge({ left: asg.charge, right: b["fiber-algebras"][j]!.assignments[i]!.charge }),
        })),
      })),
    }),
    sup: stabilizingSup<Valuation>({ eq: (a, b) => S(a) === S(b) }),
  };
  return { lattice, phi, settledValuation: settle(category).sheaf.section };
}
