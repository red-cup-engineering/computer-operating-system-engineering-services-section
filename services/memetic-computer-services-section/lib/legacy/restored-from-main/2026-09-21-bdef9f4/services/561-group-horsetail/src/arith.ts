// arith.ts — arithmetic builtins: +, -, *, /, %, =, <, >, <=, >=.
// N-ary: all ops fold over all args. ⊤ propagates; non-numeric → ⊥.
import type { Charge } from "./charge.ts";
import { T, F, BOT, TOP, potential, isTop, valueOf } from "./charge.ts";

function numVal(c: Charge): number | null {
  const v = valueOf(c);
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isNaN(n) ? null : n; }
  return null;
}

function nums(args: readonly Charge[]): number[] | null {
  const out: number[] = [];
  for (const c of args) { const n = numVal(c); if (n === null) return null; out.push(n); }
  return out;
}

function anyTop(args: readonly Charge[]): boolean {
  return args.some(isTop);
}

type ArithFn = (args: readonly Charge[]) => Charge;

export const ARITH: Record<string, ArithFn> = {
  "+"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    return potential(ns.length === 0 ? 0 : ns.reduce((a, b) => a + b, 0));
  },
  "-"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    if (ns.length === 0) return potential(0);
    if (ns.length === 1) return potential(-ns[0]!);
    return potential(ns.slice(1).reduce((a, b) => a - b, ns[0]!));
  },
  "*"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    return potential(ns.reduce((a, b) => a * b, 1));
  },
  "/"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null || ns.length === 0) return BOT;
    if (ns.length === 1) return potential(1 / ns[0]!);
    return potential(ns.slice(1).reduce((a, b) => a / b, ns[0]!));
  },
  "%"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null || ns.length < 2) return BOT;
    return potential(ns.slice(1).reduce((a, b) => a % b, ns[0]!));
  },
  // value equality: JSON-serialized so it works on any charge datum, not just numbers.
  "="(args) {
    if (anyTop(args)) return TOP;
    if (args.length < 2) return T;
    const first = JSON.stringify(valueOf(args[0] ?? BOT));
    for (let i = 1; i < args.length; i++) {
      if (JSON.stringify(valueOf(args[i] ?? BOT)) !== first) return F;
    }
    return T;
  },
  "<"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    if (ns.length < 2) return T;
    for (let i = 1; i < ns.length; i++) if (!(ns[i - 1]! < ns[i]!)) return F;
    return T;
  },
  ">"(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    if (ns.length < 2) return T;
    for (let i = 1; i < ns.length; i++) if (!(ns[i - 1]! > ns[i]!)) return F;
    return T;
  },
  "<="(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    if (ns.length < 2) return T;
    for (let i = 1; i < ns.length; i++) if (!(ns[i - 1]! <= ns[i]!)) return F;
    return T;
  },
  ">="(args) {
    if (anyTop(args)) return TOP;
    const ns = nums(args);
    if (ns === null) return BOT;
    if (ns.length < 2) return T;
    for (let i = 1; i < ns.length; i++) if (!(ns[i - 1]! >= ns[i]!)) return F;
    return T;
  },
};
