# The descent pipeline

`@561-group/meme` names the shapes involved in the descent from a bare utterance to a settled structure.

The package does not implement descent. It gives other packages a shared vocabulary for implementing, storing, validating, or exchanging descent artifacts.

## The sequence

```txt
Utterance
  ↓ articulate
Bit
  ↓ predicate
Predicated
  ↓ posit
Posited
  ↓ settle
Sheaf
```

The corresponding TypeScript morphism signatures are exported from `src/morphisms.ts`:

```ts
export type Articulate = (utterance: Utterance) => Bit;
export type Predicate = (bit: Bit) => Predicated;
export type Posit = (predicated: Predicated) => Posited;
export type Settle = (posited: Posited) => Sheaf;
```

These signatures are contracts for other packages. They say what each phase consumes and produces without deciding how the phase must be computed.

## Utterance

An `Utterance` is the bare two-fold input:

```ts
export type Utterance = readonly [Token, Claim];
```

`Token` is the identity-carrying side. `Claim` is the content-carrying side. Both are intentionally typed as `unknown`; this package names the positions but does not constrain the internal form of a token or claim.

## Articulate

`articulate` draws the first distinction.

It takes an `Utterance` and produces a `Bit`:

```ts
export interface Bit {
  readonly carrier: Utterance;
  readonly slots: readonly [readonly unknown[], readonly unknown[]];
}
```

A freshly articulated bit begins as `absurd`: both witness slots are empty. From there, slot occupancy can be read as the same four phases later represented by `Charge`.

## Predicate

`predicate` reads a bit as a predication domain.

Its output is `Predicated`:

```ts
export interface Predicated {
  readonly "cell-set": CellSet;
  readonly fiber: Fiber;
}
```

At this point the system has a cell-set and a fiber scaffold. It has not yet seeded charges.

A predication cell has the shape:

```ts
export interface Cell {
  readonly subject: unknown;
  readonly predicate: unknown;
  readonly object: unknown;
}
```

This is an oriented assertion-position over `Φ = E × Π × E`. Subject and object positions are not interchangeable. The predicate is the typed relation coordinate.

## Posit

`posit` seeds knowledge.

It turns a `Predicated` value into a `Posited` value:

```ts
export interface Posited {
  readonly presheaf: PositPresheaf;
  readonly traces: readonly Trace[];
}
```

The `PositPresheaf` is the valued presheaf built by this phase. Every relevant cell now bears a definite charge, initially seeded at the knowledge-least phase, `absurd`.

## Settle

`settle` iterates knowledge closure to a fixed point.

It takes `Posited` and returns a `Sheaf`:

```ts
export interface Sheaf {
  readonly base: BaseCategory;
  readonly section: Valuation;
}
```

A `Sheaf` is the glued settled structure: the base category plus the settled section. The section is a valuation containing the base and the charged fiber-algebras at equilibrium.

## Meme as the settled unit

A `Meme` is the thing-with-evidence that downstream packages process and store:

```ts
export interface Meme {
  readonly cell: Cell;
  readonly charge: Charge;
}
```

The `Cell` says what the meme is about. The `Charge` says what evidential state has settled onto that address.

## What belongs elsewhere

This package should not grow into the runtime that performs descent. Keep this package as the stable vocabulary layer.

Implementations of `Articulate`, `Predicate`, `Posit`, and `Settle` belong in processing packages. Storage policy belongs in memory packages. Network or federation policy belongs in packages above this one.
