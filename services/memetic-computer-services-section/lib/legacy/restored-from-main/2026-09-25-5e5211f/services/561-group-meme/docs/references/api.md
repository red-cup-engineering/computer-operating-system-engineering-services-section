# API reference

This page summarizes the public TypeScript surface of `@561-group/meme`.

The root export re-exports the package vocabulary from `src/index.ts`.

```ts
import type { Meme, Charge, Cell } from "@561-group/meme";
import { isMeme } from "@561-group/meme";
```

## Root exports

### Primitives

```ts
export type { Token, Claim, Utterance, Bit } from "./primitives.ts";
export { isBit } from "./primitives.ts";
```

#### `Token`

```ts
export type Token = unknown;
```

The identity-carrying side of an utterance. Non-assembling; does not decompose further in this package.

#### `Claim`

```ts
export type Claim = unknown;
```

The content-carrying side of an utterance. Non-assembling; does not decompose further in this package.

#### `Utterance`

```ts
export type Utterance = readonly [Token, Claim];
```

The bare two-fold `[token, claim]`. Input to `Articulate`.

#### `Bit`

```ts
export interface Bit {
  readonly carrier: Utterance;
  readonly slots: readonly [readonly unknown[], readonly unknown[]];
}
```

The unit of informational-spacetime: an utterance carrier paired with two witness slots.

#### `isBit`

```ts
export const isBit: (x: unknown) => x is Bit;
```

Shallow structural guard for `Bit`.

### Cells

```ts
export type {
  Cell,
  Edge,
  EntitySet,
  PredicateSet,
  CellSet,
  BaseCategory
} from "./cell.ts";
export { isCell } from "./cell.ts";
```

#### `Cell`

```ts
export interface Cell {
  readonly subject: unknown;
  readonly predicate: unknown;
  readonly object: unknown;
}
```

A predication cell: an oriented relational address `subject —predicate→ object` over `Φ = E × Π × E`.

#### `Edge`

```ts
export interface Edge {
  readonly source: unknown;
  readonly target: unknown;
}
```

A directed edge in a base category.

#### `EntitySet`

```ts
export interface EntitySet {
  readonly entities: readonly unknown[];
}
```

The entity dimension `E`.

#### `PredicateSet`

```ts
export interface PredicateSet {
  readonly predicates: readonly unknown[];
}
```

The predicate dimension `Π`.

#### `CellSet`

```ts
export interface CellSet {
  readonly "entity-set": EntitySet;
  readonly "predicate-set": PredicateSet;
}
```

The entity and predicate dimensions together.

#### `BaseCategory`

```ts
export interface BaseCategory {
  readonly objects: unknown;
  readonly specialization: readonly Edge[];
  readonly converse: readonly Edge[];
  readonly "subject-projection": readonly Edge[];
  readonly "object-projection": readonly Edge[];
}
```

The object set and four named morphism slots.

#### `isCell`

```ts
export const isCell: (x: unknown) => x is Cell;
```

Shallow structural guard for `Cell`.

### Charge

```ts
export type { Charge } from "./charge.ts";
export { isCharge } from "./charge.ts";
```

#### `Charge`

```ts
export interface Charge {
  readonly value: readonly [boolean, boolean];
  readonly evidence: readonly [readonly unknown[], readonly unknown[]];
}
```

The four-valued evidential word of a meme.

`value` is `[positive, negative]`. `evidence` is `[positiveWitnesses, negativeWitnesses]`.

#### `isCharge`

```ts
export const isCharge: (x: unknown) => x is Charge;
```

Shallow structural guard for `Charge`.

### Meme

```ts
export type { Meme } from "./meme.ts";
export { isMeme } from "./meme.ts";
```

#### `Meme`

```ts
export interface Meme {
  readonly cell: Cell;
  readonly charge: Charge;
}
```

The irreducible thing-with-evidence: a cell paired with a charge.

#### `isMeme`

```ts
export const isMeme: (x: unknown) => x is Meme;
```

Shallow structural guard for `Meme`. Internally checks `isCell` and `isCharge`.

### Fiber

```ts
export type { Fiber, FiberAlgebra, Valuation, Trace } from "./fiber.ts";
```

#### `Fiber`

```ts
export interface Fiber {
  readonly "cell-set": CellSet;
  readonly base: BaseCategory;
  readonly "entity-set": EntitySet;
}
```

The structural scaffold for a single predicate's domain before charges are seeded.

#### `FiberAlgebra`

```ts
export interface FiberAlgebra {
  readonly "entity-set": EntitySet;
  readonly assignments: readonly Meme[];
  readonly predicate: unknown;
}
```

Charged assignments over a single predicate's `E × E` square.

#### `Valuation`

```ts
export interface Valuation {
  readonly base: BaseCategory;
  readonly "fiber-algebras": readonly FiberAlgebra[];
}
```

The base category plus charged fiber-algebras at one step of settlement.

#### `Trace`

```ts
export interface Trace {
  readonly valuations: readonly Valuation[];
}
```

A sequence of valuations produced by a settling pass.

### Presheaf and sheaf

```ts
export type { PositPresheaf, Posited, Sheaf } from "./presheaf.ts";
```

#### `PositPresheaf`

```ts
export interface PositPresheaf {
  readonly fiber: Fiber;
  readonly base: BaseCategory;
  readonly "entity-set": EntitySet;
  readonly fibers: readonly FiberAlgebra[];
}
```

The valued presheaf built by `Posit`.

#### `Posited`

```ts
export interface Posited {
  readonly presheaf: PositPresheaf;
  readonly traces: readonly Trace[];
}
```

The presheaf plus traces, ready for `Settle`.

#### `Sheaf`

```ts
export interface Sheaf {
  readonly base: BaseCategory;
  readonly section: Valuation;
}
```

The glued settled structure: base category plus settled section.

### Morphisms

```ts
export type {
  Predicated,
  Articulate,
  Predicate,
  Posit,
  Settle
} from "./morphisms.ts";
```

#### `Predicated`

```ts
export interface Predicated {
  readonly "cell-set": CellSet;
  readonly fiber: Fiber;
}
```

The intermediate state between `Predicate` and `Posit`.

#### `Articulate`

```ts
export type Articulate = (utterance: Utterance) => Bit;
```

Draw a distinction: utterance to bit.

#### `Predicate`

```ts
export type Predicate = (bit: Bit) => Predicated;
```

Read the bit as `E × Π × E` and build the cell-set/fiber scaffold.

#### `Posit`

```ts
export type Posit = (predicated: Predicated) => Posited;
```

Seed knowledge and build the presheaf/traces.

#### `Settle`

```ts
export type Settle = (posited: Posited) => Sheaf;
```

Iterate closure to a settled sheaf.

## Subpath exports

The package exports these TypeScript subpaths:

| Subpath | Source |
| --- | --- |
| `@561-group/meme` | `./src/index.ts` |
| `@561-group/meme/primitives` | `./src/primitives.ts` |
| `@561-group/meme/cell` | `./src/cell.ts` |
| `@561-group/meme/charge` | `./src/charge.ts` |
| `@561-group/meme/meme` | `./src/meme.ts` |
| `@561-group/meme/fiber` | `./src/fiber.ts` |
| `@561-group/meme/presheaf` | `./src/presheaf.ts` |
| `@561-group/meme/morphisms` | `./src/morphisms.ts` |
