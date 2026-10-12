# @561-group/proof-pathing

The **Meme-structure → typed-path** fold, read through **Curry-Howard-Lambek**. A path is a **proof**:
the composite of predicate-category generator morphisms from a foundational root to a target. Rendered to
a typed POSIX path, the term is its own collision-free index (Yoneda), and walking the path re-checks the
proof.

## A path is a proof (CHL)

Curry-Howard-Lambek: **morphism = program = proof**. The predicate category C (the archive's
`predication-categories/bucket-3`) has terms for objects and four generator morphism classes.
A route through C from `root` to `target` is a composite morphism — and *that composite is a checkable
proof that the target is reachable from the foundation.* The cone's apex is the initial algebra of the
closure operator (Lambek), equivalently the **least fixed point** of path-composition.

## The four generators

`structureOf(cells)` folds a knowledge base of cells `{subject, predicate, object}` into atomic generator
edges. The four classes (each a bilattice hom between fiber algebras `A_p = L^(E×E)`):

| generator | from a cell `(s,p,o)` | meaning |
|---|---|---|
| **specialization** | an `is-a` cell `(s, is-a, o)` → edge `o → s` | the type `o` specializes to the instance `s` (the `/library/` spine) |
| **converse** | `(s,p,o) → (o,p,s)` | the index swap |
| **subject-projection** | `(s,p,o) → s` | collapse to the subject |
| **object-projection** | `(s,p,o) → o` | collapse to the object |

A relational cell is itself a node (a compound term); the three relational generators leave it for its
subject, object, and converse. (Edges are recorded in the f\* / pullback direction; the quantifier
adjoints ∃⊣f\*⊣∀ that traverse the other way are a later extension.)

## Proof = least fixed point + a witness

```ts
import { structureOf, prove, walk, cellOf } from "@561-group/proof-pathing";

const atoms = structureOf([
  { subject: "room", predicate: "is-a", object: "paracosm" },
  { subject: "paracosm", predicate: "is-a", object: "category" },
]);

const p = prove(atoms, "category", "room");
p.path;        // "category/specialization/library/paracosm/specialization/library/room"
p.generators;  // ["specialization", "specialization"]  — the proof term
walk(atoms, p.path).ok; // true — the proof is checkable
```

- **`closure(atoms)`** — the transitive closure of the generator graph: the MPU's `saturate` (μ of the
  path-composition monad, `(a,p,b)·(b,q,c)↦(a,[p,q],c)`) driven to its **least fixed point** by `ascend`
  (Kleene/Knaster–Tarski). This is the authoritative reachability (Lambek's initial algebra). The
  path monad is **reused** from `@561-group/memetic-processing-unit/void` — single source of truth.
- **`routeOf(atoms, root, target)`** — a witnessing BFS that keeps the intermediate terms `saturate`
  forgets, so the proof can be rendered. A route exists iff the closure contains the composite.
- **`render` / `parsePath` / `walk`** — render a route to the typed path `root/<generator>/library/<term>/…`
  (the mm / `grow.mjs` convention, where each `/library/` step is the term a generator lands on); `walk`
  re-checks a rendered path hop-by-hop against the structure.

The only data dependency is `@561-group/meme` (type-only, erased). The sole runtime dependency is the
MPU's path monad.

## Provenance

The fold (`pathOf`) and its fixpoint helper (`ascend`) were extracted from `computer/mm/term-memory`,
which only built `specialization` from *monadic* `(entity, concept)` predications. The relational
structure (all four generators) is built here from the proven generators in
`math/math-playground/src/predicate/generators.mjs`, and the path-as-proof convention follows the MUD tab
(`archive/.../tab-2026-05-25/.../grow.mjs`): *"a checkable Curry-Howard proof term whose path proves σ
placed it there … east-of is its converse (predicate-category's converse generator), read by inversion."*

## Open modeling decisions (for review)

1. **Edge direction** — generators are recorded in the f\* (pullback) direction; specialization runs
   type→instance (general→specific), matching `grow.mjs`. The ∃/∀ adjoints (reverse traversal) are not yet
   instantiated.
2. **Specialization source** — taken from the `is-a` predicate (configurable). The generators also license
   specialization by **sub-support inclusion** (`supp(q) ⊆ supp(p)`); deriving that from a KB is a
   follow-up.
3. **Cell node serialization** — a compound cell node renders as one segment (sanitized JSON);
   bare string terms render human-readably.

## Development

TypeScript, **zero build** — runs on Node ≥ 22.18 via native type stripping.

```sh
pnpm test     # node --test
pnpm check    # tsc --noEmit (strict)
```
