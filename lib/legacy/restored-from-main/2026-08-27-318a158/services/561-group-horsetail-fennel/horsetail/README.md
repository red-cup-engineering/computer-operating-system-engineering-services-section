# Horsetail

The 561-group computer's **native programming language** — its C/Scheme-equivalent, the thing you
write programs for this machine in. A **paraconsistent settling Lisp**. The name is provisional (after
Nuel Belnap, whose four-valued logic IS the value algebra); it lives in one constant, `LANGUAGE_NAME`,
so a rename touches one place.

This is an **OS tool** under `computer/` (the kernel ships its language). It is **pure over the
substrate** — no `node:fs`, no app concern; the trace is in-memory data and persisting bytes is the
host's job (posix-holography). The settling shell (`apps/interface/shell`) is its REPL.

## The one inversion

A normal Lisp is homoiconic over cons cells and `eval` is a function call. Horsetail is homoiconic over
**predication cells**, and **`eval` is `settle`**. Evaluating a form appends predications to an
append-only `{e,a,v,t}` trace and settles it to a Knaster–Tarski fixed point; the "value" is the
projected settled **charge**, collapsed to a scalar only at the edge where you must act (`(boolean x)`).
**The program is a trace; running it is folding it.** There is no clock — settling is aperiodic, not
stepping.

## Values: every value is a charge

Truthiness is **four-valued**: `t`, `f`, `⊥` (no evidence), `⊤` (contradiction, **HELD** — a bindable
value, never an error). Two σ-dual and/or families: knowledge `(k-and …)`/`(k-or …)` (⊗/⊕) and truth
`(and …)`/`(or …)` (∧/∨). `(not x)` is the truth involution; `(conflate x)` the knowledge involution.
`(if x a b)` is four-valued: `t`→then, `f`→else, `⊥`→pending, `⊤`→runs **both** arms held contested.

## Special forms = the OS ops

| form | OS op |
|---|---|
| `(assert s p o)` / `(deny s p o)` | append a (charged) row; negative evidence is the **converse** predication |
| `(define name expr)` | **append-only** binding — re-define adds counter-evidence, never overwrites |
| `(recall …)` / `(query subj)` | predicate-algebra recall / believe over the settled section |
| `(settle subj)` / `(section subj)` | force the fixed point / project `{affirmed,denied,contradicted}` |
| `(relate p o)` / `(relate-from s p)` | the general relational graph reads |
| `(quote …)` `(quasiquote …)` `(defmacro …)` | homoiconic over cells — a macro transforms cells |
| `(must …)` `(should …)` `(may …)` | the modal □/◇ via the kernel's necessitate/possibilise |
| `(at path …)` | typed-path addressing — lexical scope IS the path tree |
| `(as principal …)` | act as a principal (computer/principal); ⊤-dispute surfaced, never denied |
| `(federate (forms…) subj)` | tensor-merge two traces (computer/distribution); disagreement → ⊤ |

## Built on (by name — re-derives nothing; math never imports computer)

- `@561-group/computer/posix-holography/eavt-substrate` — `fold` / `settle` / `section` / `relate` / `relate-from` / `rowId`
- `believe` (the belief read-out) — now in-package (`src/believe.mjs`), absorbed from the retired predicate-algebra-parser tile
- `@561-group/math/bilattice` — the charge algebra, the σ-dual orders, the modal generators, `settle`
- `@561-group/math/chu/four` — `FOUR`, the charge⇄name codec
- `@561-group/horsetail/distribution` — `federate` (the tensor ∥)
- `@561-group/horsetail/principal` — `may` (the `as` capability hook)

> RECOVERY NOTE: as first written, this section and the import below named `@561-group/computer/...`
> — horsetail's original location as a subpath of `computer/`. Recovered as the standalone
> `@561-group/horsetail` package instead (see the top-level package README's "Recovery notes"); the
> paths above are updated to match where recovery actually placed each piece.

## The surface

```js
import { world, run, step, read, write, glyph } from "@561-group/horsetail";
const w = world();                       // a fresh world with the stdlib loaded
run("(assert sky has blue)", w);         // -> charge t
run("(deny sky has blue)", w);           // -> charge ⊤ (held contradiction, bindable)
glyph(run("(recall sky has)", w));       // -> "⊤"
```

`run(src, w?)` settles every top-level form and returns the last charge. `step(src, w)` is the
shell's read→settle→project step (`{ charge, glyph, four, world }`). `read`/`readAll`/`write` are the
homoiconic front (s-expressions ⇄ cells).

## The general-purpose surface (meets-or-beats Fennel)

Atop the OS ops, Horsetail carries the full surface of a general-purpose Lisp — every feature reframed to
work WITH charges/⊤/settling, not against them:

| category | forms | the reframe / the BEAT |
|---|---|---|
| functions | `(fn (params…) body…)`, `(apply f a…)`, bare `(f a b)` | a fn is a **charge** carrying a quoted body + captured scope path; its body **settles** (can assert/deny, hold ⊤, query the trace) |
| varargs / values | `(fn (a . rest) …)`, `(values a b c)`, `(let-values ((x y) …) …)` | a dotted tail binds a seq; multiple values ride one charge's evidence (nothing dropped) |
| closures | implicit in `(fn …)` | captures a **path**, not a mutable cell — free names recall from their trace rows; closures see the settled belief, ⊤ included |
| bindings | `(let ((x e)…) body…)` | sugar over a fresh gensym scope + `(define …)` — each binding is an auditable trace row; shadowing is a deeper path, never an overwrite |
| destructuring | `(let (((a b) seq) …) …)`, `(fn ((x y)) …)` | a pattern cell binds from a seq/predication via the shared pattern binder |
| control flow | `(do …)` `(when c …)` `(unless c …)` `(cond (t e)…)` `(case s …)` | four-valued: a `⊤` `cond` test runs its arm AND falls through (Fennel cannot) |
| **pattern matching** | `(match subj (pat guard? body)…)` — `_` wildcard, `?x` binder, `(or …)`, `(? guard p)` | returns a **four-valued match charge**; a clause can **match a ⊤ subject and run under the contradiction** (the hard beat) |
| iteration | `(for-each f s)` `(fold f init s)` `(reduce …)` `(map …)` `(filter …)` `(range n)` | folds over the seq carrier; unbounded folds need no stack budget (settling, no clock) |
| sequences | `(seq …)` `(seq-head …)` `(seq-tail …)` `(seq-empty? …)` `(seq-nth …)` `(filter-hold …)` | `(seq-head (seq))` is `⊥`, not a crash; `filter-hold` KEEPS a `⊤` element (four-valued maybe) |
| math / compare | `(+ - * / %)` `(< > <= >= =)` | comparison returns a **charge** — `(= x x)` over a ⊤ operand is `⊤` (uncertainty carried, not forced boolean) |
| strings | `(str …)` `(len s)` `(sub s i j)` `(upper …)` `(lower …)` `(str= …)` | host ops at the charge boundary |
| collections | `(assoc s k v)` `(dissoc s k v)` `(get s k)` `(merge other s)` `(keys s)` | a table IS a subject — `dissoc` DENIES (key goes f/⊤, never silently gone); `merge` is **federate** (conflict → ⊤, not last-write-wins) |
| threading | `(-> x …)` `(->> x …)` `(-?> x …)` `(?. subj k…)` | `-?>` short-circuits on `⊥` (absent) but HOLDS on `⊤` (contradicted) — a four-valued maybe-thread |
| modules | `(module /name body…)` `(require /name)` `(import /name)` `(export …)` | a module is a path **subtree**; require is **federate** (clashing exports → ⊤, surfaced not shadowed) |
| error handling | `(raise x)` `(try body… (catch ?e h…))` | an error is a `⊥`/`⊤` you **HOLD** — never a host throw; `(try …)` catches a ⊥/⊤ body (or a host fault, surfaced as ⊤) |
| hygiene / compile | `(gensym prefix?)`, `%%`-marked macro locals auto-renamed; `(macroexpand-all form)` | gensym off a dedicated counter; compile = full expansion to a residual core-form cell (settle IS eval, no codegen) |
| four-valued tests | `(affirmed? x)` `(denied? x)` `(held? x)` `(pending? x)` `(boolean x)` | project the charge's bits explicitly (collapse only at the edge) |

The stdlib (`scripts/stdlib.mjs`) is written **in Horsetail** — macros + fn definitions settled into the
trace before a program runs. Pattern matching lives in `scripts/pattern.mjs`; host primitives in
`scripts/arith.mjs` / `strings.mjs` / `seq.mjs` (computer-layer, kept out of the math kernel).

## The law (the acceptance test)

Paraconsistent (`⊤` held, not error), append-only (eval settles the trace; `define` appends), evidence
linear (no dropped witnesses), identity via `jcs`/`rowId`, pure over the substrate. If `eval` were a
function call and truth a boolean, it would be a Lisp on the shadow — not on this computer. Proved in
`tests/run.mjs` (the 57 LAW proofs) and `tests/parity.mjs` (the 70 Fennel-parity + beat proofs):
`node Horsetail/tests/run.mjs && node Horsetail/tests/parity.mjs`.
