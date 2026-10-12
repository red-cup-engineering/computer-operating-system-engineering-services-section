# Terms

This glossary defines the main terms used by `@561-group/meme`.

## absurd

The charge phase `[false, false]`.

No side is marked. No information has been placed into either witness carrier.

For a fresh `Bit`, this corresponds to both slots being empty:

```ts
slots: [[], []]
```

## active

The charge phase `[false, true]`.

The negative mark is present and the positive mark is absent.

## articulate

The first descent morphism.

Type:

```ts
type Articulate = (utterance: Utterance) => Bit;
```

`articulate` takes an utterance and produces a bit.

## base category

The object set and named morphism slots for the predication domain.

Type:

```ts
interface BaseCategory {
  objects: unknown;
  specialization: Edge[];
  converse: Edge[];
  "subject-projection": Edge[];
  "object-projection": Edge[];
}
```

This package names the slots. It does not implement categorical closure.

## bit

The unit of informational-spacetime.

Type:

```ts
interface Bit {
  carrier: Utterance;
  slots: [unknown[], unknown[]];
}
```

A bit carries an utterance and two witness slots. Slot occupancy can be read as absurd, potential, active, or stable.

## cell

A predication cell.

Type:

```ts
interface Cell {
  subject: unknown;
  predicate: unknown;
  object: unknown;
}
```

A cell is an oriented relational address:

```txt
subject —predicate→ object
```

It is the identity of a meme: what the meme is about.

## cell-set

The entity and predicate dimensions together.

Type:

```ts
interface CellSet {
  "entity-set": EntitySet;
  "predicate-set": PredicateSet;
}
```

A cell-set defines the domain `Φ = E × Π × E` for predication.

## charge

The four-valued evidential word of a meme.

Type:

```ts
interface Charge {
  value: [boolean, boolean];
  evidence: [unknown[], unknown[]];
}
```

`value` is `[positive, negative]`. `evidence` is `[positiveWitnesses, negativeWitnesses]`.

## claim

The content-carrying side of an utterance.

Type:

```ts
type Claim = unknown;
```

`Claim` is intentionally unconstrained in this package.

## descent

The typed sequence:

```txt
Utterance → Bit → Predicated → Posited → Sheaf
```

Named by the morphism types:

```txt
articulate → predicate → posit → settle
```

This package types the sequence. It does not implement the runtime.

## edge

A directed edge in a base category.

Type:

```ts
interface Edge {
  source: unknown;
  target: unknown;
}
```

## entity

A value in the `E` dimension of `Φ = E × Π × E`.

Entity values are typed as `unknown` so consuming packages can decide how entities are represented.

## entity-set

The entity dimension.

Type:

```ts
interface EntitySet {
  entities: unknown[];
}
```

## evidence

The lossless witness carrier of a charge.

Evidence has two slots:

```txt
[positiveWitnesses, negativeWitnesses]
```

Consumers should not erase evidence merely to force a Boolean result.

## fiber

The structural scaffold for a single predicate's domain before charges are seeded.

Type:

```ts
interface Fiber {
  "cell-set": CellSet;
  base: BaseCategory;
  "entity-set": EntitySet;
}
```

## fiber-algebra

The charged assignment layer over a single predicate's `E × E` square.

Type:

```ts
interface FiberAlgebra {
  "entity-set": EntitySet;
  assignments: Meme[];
  predicate: unknown;
}
```

Each assignment is a `Meme`.

## meme

The irreducible thing-with-evidence.

Type:

```ts
interface Meme {
  cell: Cell;
  charge: Charge;
}
```

A meme pairs a relational identity with a four-valued evidential state.

## morphism

In this package, a named transformation type in the descent pipeline.

The exported morphism types are:

- `Articulate`
- `Predicate`
- `Posit`
- `Settle`

They are type signatures, not implementations.

## posit

The descent morphism that seeds knowledge and produces a `Posited` value.

Type:

```ts
type Posit = (predicated: Predicated) => Posited;
```

## posited

The output of `Posit`.

Type:

```ts
interface Posited {
  presheaf: PositPresheaf;
  traces: Trace[];
}
```

## posit-presheaf

The valued presheaf built by `Posit`.

Type:

```ts
interface PositPresheaf {
  fiber: Fiber;
  base: BaseCategory;
  "entity-set": EntitySet;
  fibers: FiberAlgebra[];
}
```

## potential

The charge phase `[true, false]`.

The positive mark is present and the negative mark is absent.

## predicate

A value in the `Π` dimension of `Φ = E × Π × E`.

Also the name of the descent morphism that reads a `Bit` into a `Predicated` structure:

```ts
type Predicate = (bit: Bit) => Predicated;
```

The same word appears in both senses. Context distinguishes the coordinate from the morphism type.

## predicate-set

The predicate dimension.

Type:

```ts
interface PredicateSet {
  predicates: unknown[];
}
```

## predicated

The intermediate state between `Predicate` and `Posit`.

Type:

```ts
interface Predicated {
  "cell-set": CellSet;
  fiber: Fiber;
}
```

## settle

The descent morphism that turns a `Posited` value into a `Sheaf`.

Type:

```ts
type Settle = (posited: Posited) => Sheaf;
```

A real implementation should iterate knowledge closure to the relevant fixed point. This package only names the signature.

## sheaf

The glued settled structure.

Type:

```ts
interface Sheaf {
  base: BaseCategory;
  section: Valuation;
}
```

A sheaf carries the base category and the settled section.

## stable

The charge phase `[true, true]`.

Both marks are present. This is not malformed data. It means contradiction, saturation, or two-sided evidence is being held instead of discarded.

## token

The identity-carrying side of an utterance.

Type:

```ts
type Token = unknown;
```

`Token` is intentionally unconstrained in this package.

## trace

A sequence of valuations produced by one settling pass.

Type:

```ts
interface Trace {
  valuations: Valuation[];
}
```

## utterance

The bare two-fold input to `Articulate`.

Type:

```ts
type Utterance = readonly [Token, Claim];
```

Read as `[token, claim]`.

## valuation

The base category plus charged fiber-algebras at one step of settling.

Type:

```ts
interface Valuation {
  base: BaseCategory;
  "fiber-algebras": FiberAlgebra[];
}
```

## witness

An item in a bit slot or charge evidence slot.

Witnesses are typed as `unknown` because this package does not decide what counts as evidence for every consumer.
