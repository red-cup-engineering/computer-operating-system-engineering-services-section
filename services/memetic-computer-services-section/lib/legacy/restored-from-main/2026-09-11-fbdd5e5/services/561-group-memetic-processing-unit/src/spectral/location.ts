// location.ts — root-location relative to the unit circle, via the Cayley map and an owned Routh/Sturm count.
//
// Cayley map z = (1+w)/(1−w): |z|<1 ↔ Re w < 0, |z|=1 ↔ Re w = 0, |z|>1 ↔ Re w > 0.
// `mobius` carries an integer polynomial p to q(w) in ℤ[w]; `rightHalfPlaneRoots` runs the Routh array
// over our ℚ; `rootLocation` reports expanding/contracting/neutral counts.

import * as Z from "../number/integer.ts";
import * as Q from "../number/rational.ts";
import type { Integer } from "../number/integer.ts";
import type { Rational } from "../number/rational.ts";

type ZPoly = Integer[];
type QPoly = Rational[];

const znorm = (p: ZPoly): ZPoly => { let h = p.length - 1; while (h > 0 && Z.isZero(p[h]!)) h--; return p.slice(0, h + 1); };
const zdeg = (p: ZPoly): number => znorm(p).length - 1;

const zadd = (a: ZPoly, b: ZPoly): ZPoly => {
  const n = Math.max(a.length, b.length);
  return znorm(Array.from({ length: n }, (_, i) => Z.add(a[i] ?? Z.zero, b[i] ?? Z.zero)));
};

const zmul = (a: ZPoly, b: ZPoly): ZPoly => {
  const r: ZPoly = Array.from({ length: a.length + b.length - 1 }, () => Z.zero);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++)
    r[i + j] = Z.add(r[i + j]!, Z.multiply(a[i]!, b[j]!));
  return znorm(r);
};

const zscale = (s: Integer, p: ZPoly): ZPoly => p.map((c) => Z.multiply(s, c));
const zpow = (base: ZPoly, k: number): ZPoly => { let r: ZPoly = [Z.one]; for (let i = 0; i < k; i++) r = zmul(r, base); return r; };

const ONE_PLUS: ZPoly = [Z.one, Z.one];
const ONE_MINUS: ZPoly = [Z.one, Z.negate(Z.one)];

export function mobius(p: ZPoly): ZPoly {
  const a = znorm(p), n = a.length - 1;
  let q: ZPoly = [Z.zero];
  for (let k = 0; k <= n; k++) q = zadd(q, zscale(a[k]!, zmul(zpow(ONE_PLUS, k), zpow(ONE_MINUS, n - k))));
  return znorm(q);
}

export function rightHalfPlaneRoots(q: QPoly): { rhp: number | null; singular: boolean } {
  const d = q.length - 1;
  const c = [...q].reverse();
  const rows: QPoly[] = [[], []];
  for (let j = 0; 2 * j <= d; j++) rows[0]!.push(c[2 * j]!);
  for (let j = 0; 2 * j + 1 <= d; j++) rows[1]!.push(c[2 * j + 1]!);
  for (let i = 2; i <= d; i++) {
    const a = rows[i - 1]!, b = rows[i - 2]!;
    if (!a.length || Q.isZero(a[0]!)) return { rhp: null, singular: true };
    const row: QPoly = [];
    for (let j = 0; j + 1 < b.length; j++) {
      const term = Q.subtract(Q.multiply(a[0]!, b[j + 1]!), Q.multiply(b[0]!, a[j + 1] ?? Q.zero));
      row.push(Q.divide(term, a[0]!));
    }
    rows.push(row.length ? row : [Q.zero]);
  }
  const col = rows.map((r) => r[0] ?? Q.zero);
  if (col.some(Q.isZero)) return { rhp: null, singular: true };
  let changes = 0;
  for (let i = 1; i < col.length; i++) if (Q.sign(col[i - 1]!) !== Q.sign(col[i]!)) changes++;
  return { rhp: changes, singular: false };
}

export interface RootLocation {
  expanding: number | null;
  contracting: number | null;
  neutral: number | null;
  degenerate: boolean;
}

export function rootLocation(p: ZPoly): RootLocation {
  const n = zdeg(p);
  const q = mobius(p);
  const dq = zdeg(q);
  const dropped = n - dq;
  const { rhp, singular } = rightHalfPlaneRoots(q.map(Q.fromInteger));
  if (singular) return { expanding: null, contracting: null, neutral: null, degenerate: true };
  return { expanding: rhp, contracting: dq - rhp!, neutral: dropped, degenerate: false };
}

export function isPisot(p: ZPoly): boolean {
  const loc = rootLocation(p);
  return !loc.degenerate && loc.expanding === 1 && loc.neutral === 0;
}
