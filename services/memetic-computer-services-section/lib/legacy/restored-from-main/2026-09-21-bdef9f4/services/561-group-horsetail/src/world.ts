// world.ts — the World: an Mpu (domain KB) + MemeStore + lexical env + registries.
// The Mpu is the knowledge base — assert/deny/recall/settle go through it.
// The env (plain Map) is the lexical scope — define/let/fn bindings live here.
import { Mpu } from "@561-group/memetic-processing-unit";
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Charge } from "./charge.ts";
import type { Form } from "./types.ts";

// ── Env ───────────────────────────────────────────────────────────────────────

/** A mutable lexical environment: name → charge. */
export type Env = Map<string, Charge>;

// ── function/macro definitions ────────────────────────────────────────────────

/** A Horsetail-defined function (closure over its defining env). */
export interface FnDef {
  readonly kind: "fn";
  readonly params: readonly string[];
  readonly rest: string | null;
  readonly body: readonly Form[];
  readonly closure: ReadonlyMap<string, Charge>;
}

/** A natively-implemented function (TypeScript callback). */
export interface NativeDef {
  readonly kind: "native";
  readonly fn: (args: readonly Charge[], world: World) => Charge;
}

/** A macro: expands forms, not values. */
export interface MacroDef {
  readonly params: readonly string[];
  readonly rest: string | null;
  readonly body: Form;
}

export type AnyDef = FnDef | NativeDef;

// ── World ─────────────────────────────────────────────────────────────────────

export interface World {
  /** The domain knowledge base — assert/deny/recall/settle pass through here. */
  readonly mpu: Mpu;
  /** Raw meme store — for explicitly stored memes via (store-meme …). */
  readonly store: MemeStore;
  /** Global lexical environment — define mutates this at top level. */
  readonly env: Env;
  /** Current typed-path scope (for module addressing). */
  scope: string;
  /** Current principal (for authority checks). */
  principal: unknown;
  /** Monotone counter for gensym. */
  gensymCount: number;
  /** Function / native-fn registry. */
  readonly fns: Map<string, AnyDef>;
  /** Macro registry. */
  readonly macros: Map<string, MacroDef>;
  /** Module source registry. */
  readonly modules: Map<string, readonly Form[]>;
}

// ── constructor ───────────────────────────────────────────────────────────────

/** Create a fresh, empty World. The stdlib caller populates env, fns, and macros afterward. */
export function makeWorld(): World {
  return {
    mpu: new Mpu(),
    store: new MemeStore(),
    env: new Map(),
    scope: "/",
    principal: null,
    gensymCount: 0,
    fns: new Map(),
    macros: new Map(),
    modules: new Map(),
  };
}

/** Generate a fresh, collision-free symbol name. */
export function gensym(world: World): string {
  return `%%g${world.gensymCount++}`;
}

/** Generate a fresh symbol with a given prefix. */
export function gensymWith(world: World, prefix: string): string {
  return `%%${prefix}-${world.gensymCount++}`;
}

/** Parse a function parameter list: `(a b . rest)` → `{ params: ["a","b"], rest: "rest" }`. */
export function parseParams(forms: readonly Form[]): { params: readonly string[]; rest: string | null } {
  const params: string[] = [];
  let rest: string | null = null;
  let dotSeen = false;

  for (const f of forms) {
    if (f.kind === "sym" && f.name === ".") { dotSeen = true; continue; }
    if (f.kind !== "sym") continue;
    if (dotSeen) { rest = f.name; break; }
    params.push(f.name);
  }

  return { params, rest };
}
