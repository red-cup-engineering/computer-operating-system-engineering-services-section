// natural.ts — ℕ as a settled membership extension, built on the live floor.
//
// A natural number is the positive EXTENSION of a membership claim: the tokens whose membership, once
// SETTLED, lands at t. Zero is REACHED: telling the boundary token both member and not-member, the
// knowledge-meet reaches ⊥, so the extension is empty. Successor settles one more token to t.
// Numbers are interned (one canonical object per value) so equality is object identity.
import type { Charge } from "@561-group/meme";
import { settle, posit, predicate, articulate } from "../descent.ts";
import { negate as kernelNegate, meetKnowledge, present } from "../charge.ts";
import { fromMatrix, extension, FOUR } from "../chu/index.ts";

// ── the two membership values, taken from the floor ──────────────────────────

const MEMBER_CHARGE = settle(posit(predicate(articulate(["token", "memberOf"]))))
  .sheaf.section["fiber-algebras"][0]!.assignments[0]!.charge;

const BOUNDARY_CHARGE = meetKnowledge({ left: MEMBER_CHARGE, right: kernelNegate(MEMBER_CHARGE) });

function chargeToFour(charge: Charge): "t" | "f" | "bot" | "top" {
  const [p, n] = present(charge);
  return p && n ? FOUR.TOP : p ? FOUR.T : n ? FOUR.F : FOUR.BOT;
}

const MEMBER_VALUE   = chargeToFour(MEMBER_CHARGE);    // t
const BOUNDARY_VALUE = chargeToFour(BOUNDARY_CHARGE);  // ⊥ (bot)

// ── the natural number type ───────────────────────────────────────────────────

export interface Natural {
  readonly id: number;
  readonly members: readonly Natural[];
  readonly sig: string;
}

let nextId = 0;
const registry = new Map<string, Natural>();

function intern(memberList: readonly Natural[]): Natural {
  const seen = new Set<number>();
  const uniq: Natural[] = [];
  for (const m of memberList) if (!seen.has(m.id)) { seen.add(m.id); uniq.push(m); }
  uniq.sort((a, b) => a.id - b.id);
  const sig = uniq.map((m) => m.id).join(",");
  let n = registry.get(sig);
  if (!n) { n = { id: nextId++, members: uniq, sig }; registry.set(sig, n); }
  return n;
}

/** 0 — reached, not seeded. */
export const zero: Natural = intern([]);

/** The successor S(n) = n ∪ {n}: one more token settles to t. */
export const successor = (n: Natural): Natural => intern([...n.members, n]);

/** 1 = S(0). */
export const one: Natural = successor(zero);

/** The members of n — its von Neumann extension {0,…,n−1}. */
export const members = (n: Natural): Natural[] => [...n.members];

/** Is n zero? */
export const isZero = (n: Natural): boolean => n.members.length === 0;

/** Equality — same canonical object (object identity). */
export const equal = (a: Natural, b: Natural): boolean => a.id === b.id;

/** m ∈ n — m is a token of n's extension. */
export const isMember = (m: Natural, n: Natural): boolean => n.members.some((x) => x.id === m.id);

/** m ≤ n — inclusion: every token of m settles to t in n. */
export const leq = (m: Natural, n: Natural): boolean => m.members.every((x) => isMember(x, n));

/** m < n — strict membership. */
export const less = isMember;

/** Total comparison: −1 if m < n, 0 if equal, +1 if m > n. */
export const compare = (m: Natural, n: Natural): -1 | 0 | 1 =>
  equal(m, n) ? 0 : less(m, n) ? -1 : 1;

/** The predecessor n−1 — the ⊆-greatest member of n. pred(0) = 0. */
export const predecessor = (n: Natural): Natural =>
  isZero(n) ? zero : n.members.reduce((a, b) => (a.members.length >= b.members.length ? a : b));

/** m + n — m + 0 = m; m + S(p) = S(m + p). */
export function add(m: Natural, n: Natural): Natural {
  return isZero(n) ? m : successor(add(m, predecessor(n)));
}

/** m · n — m · 0 = 0; m · S(p) = m + (m · p). */
export function multiply(m: Natural, n: Natural): Natural {
  return isZero(n) ? zero : add(m, multiply(m, predecessor(n)));
}

/** m ∸ n — truncated subtraction floored at 0. */
export function monus(m: Natural, n: Natural): Natural {
  return isZero(n) ? m : isZero(m) ? zero : monus(predecessor(m), predecessor(n));
}

/** Division with remainder: n = quotient·d + remainder, remainder < d. Throws on d = 0. */
export function divmod(n: Natural, d: Natural): { quotient: Natural; remainder: Natural } {
  if (isZero(d)) throw new RangeError("natural divmod: division by zero");
  let quotient = zero, remainder = n;
  while (leq(d, remainder)) { remainder = monus(remainder, d); quotient = successor(quotient); }
  return { quotient, remainder };
}

/** GCD by the Euclidean algorithm. gcd(a, 0) = a. */
export function gcd(a: Natural, b: Natural): Natural {
  while (!isZero(b)) { const r = divmod(a, b).remainder; a = b; b = r; }
  return a;
}

// ── extension realization ─────────────────────────────────────────────────────

const tokenOf = (n: Natural): string => `#${n.id}`;

/** n AS a Chu space over FOUR — its `∈` claim over the universe {0,…,n}. */
export function asExtension(n: Natural): ReturnType<typeof fromMatrix> {
  const universe = [...n.members, n];
  const matrix: Record<string, Record<string, "t" | "f" | "bot" | "top">> = {};
  for (const x of n.members) matrix[tokenOf(x)] = { "∈": MEMBER_VALUE };
  matrix[tokenOf(n)] = { "∈": BOUNDARY_VALUE };
  return fromMatrix(universe.map(tokenOf), ["∈"], matrix);
}

/** The tokens whose membership settles to t — n's extension. |extensionOf(n)| = n. */
export const extensionOf = (n: Natural): string[] => extension(asExtension(n), "∈");

// ── boundary reads (host counts ↔ naturals) ───────────────────────────────────

/** The host size of a natural: |n| = n. */
export const toCount = (n: Natural): number => n.members.length;

/** Build the natural for a host count k ≥ 0. */
export function fromCount(k: number): Natural {
  let n = zero;
  for (let i = 0; i < k; i++) n = successor(n);
  return n;
}
