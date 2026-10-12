# Descent, charge, and closure

The MPU's central operation is structure-preserving descent.

```txt
utterance
  ↓ articulate
potential
  ↓ predicate
predicated cell/fiber scaffold
  ↓ cohere
composition-closed scaffold
  ↓ posit
presheaf with measured charges and traces
  ↓ commutate
modal trace carrier
  ↓ settle
sheaf with settled section
```

The important discipline is that the MPU carries structure through the whole pipeline. It does not collapse the process to a Boolean verdict.

## Charge is the MPU word

The `Charge` type comes from `@561-group/meme`. The MPU defines operations over it.

A charge has two value bits:

```txt
[positive, negative]
```

and two evidence carriers:

```txt
[positiveWitnesses, negativeWitnesses]
```

The four named readings are:

| Value | MemeCharge | Reading |
| --- | --- | --- |
| `[false, false]` | `absurd` | no side; no information |
| `[true, false]` | `potential` | positive only |
| `[false, true]` | `active` | negative only |
| `[true, true]` | `stable` | both sides held |

The charge module provides:

- `present`
- `isTop`
- `isBottom`
- `negate`
- `conflate`
- `joinKnowledge`
- `meetKnowledge`
- `joinTruth`
- `meetTruth`
- `leqKnowledge`
- `compareKnowledge`
- `aggregate`
- `bottom`
- `potential`

All binary lattice operations accumulate evidence. They do not throw witnesses away when the value changes.

## The two involutions

`negate` is the truth involution. It swaps positive and negative value bits and moves their evidence with them.

```ts
negate({
  value: [true, false],
  evidence: [["witness"], []]
});

// value: [false, true]
// evidence: [[], ["witness"]]
```

`conflate` is the knowledge involution. It maps `[pos, neg]` to `[!neg, !pos]`. It swaps absurd and stable while fixing the one-sided values.

## The four descent functions

### `articulate`

```ts
articulate(["socrates", "mortal"]);
// { potential: ["socrates", "mortal"] }
```

`articulate` witnesses an utterance into a potential. It does not assign semantic meaning yet.

### `predicate`

```ts
const predicated = predicate(articulate(["socrates", "mortal"]));
```

`predicate` reads the potential as a small `E × Π × E` scaffold. The left side becomes the entity dimension and the right side becomes the predicate dimension.

### `posit`

```ts
const posited = posit(predicated);
```

`posit` measures each cell to a fresh potential charge `[true, false]`, witnessed by the subject. It builds a `PositPresheaf` and an initial trace.

For a single utterance, the measured cell is self-referential:

```ts
{
  subject: "socrates",
  predicate: "mortal",
  object: "socrates"
}
```

### `settle`

```ts
const { sheaf } = settle(posited);
```

`settle` iterates the knowledge closure until the last valuation stops changing. The result is a `Sheaf`, whose `section` is the settled valuation.

Use `settleTraced` when you also need the valuation history and closure depth.

## Modal closure

The modal operators append valuation steps to a `Posited` value's traces.

Knowledge order:

- `raiseKnowledge`
- `lowerKnowledge`
- `possibilizeKnowledge`
- `necessitateKnowledge`

Truth order:

- `raiseTruth`
- `lowerTruth`
- `possibilizeTruth`
- `necessitateTruth`

`settle` uses the knowledge pair:

```txt
possibilizeKnowledge(necessitateKnowledge(current))
```

until a fixed point is reached.

## Composition over a knowledge base

The single-utterance descent handles one utterance. The `compose` function drives many witnesses through the system and folds witnesses of the same cell.

```ts
import { compose, chargeAt, memeChargeOf } from "@561-group/memetic-processing-unit";

const sheaf = compose([
  ["sky", "blue"],
  ["sky", "blue", false]
]);

const charge = chargeAt(sheaf.section, {
  subject: "sky",
  predicate: "blue",
  object: "sky"
});

memeChargeOf(charge); // "stable"
```

Affirmation and denial meet in knowledge join, producing stable charge while keeping both evidence sides.

## Compare consistent and paraconsistent parts

`compare` splits a valuation into:

- `consistent`: assignments whose charge is not stable;
- `paraconsistent`: assignments whose charge is stable.

```ts
const { consistent, paraconsistent } = compare(sheaf.section);
```

This is a projection. It does not mutate the section.

## Cone duals

The cone module provides dual fixed-point reads.

- `brim`: knowledge greatest fixed point, raises free negative bits to stable before closure.
- `adjudicate`: truth least fixed point.
- `presume`: truth greatest fixed point, raises free negative bits toward potential before truth closure.

These functions use the same trace/closure machinery but read different order-theoretic sides of the same carrier.

## Void reads

The void module reads what remains underdetermined between fixed points.

- `gap({ least, greatest })` compares least and greatest valuations cell by cell.
- `vanish(posited)` computes `gap(settle(posited), brim(posited))`.
- `estrange(predicated)` finds pairs never related by `cohere` closure.
- `saturate`, `transfer`, `twistor`, and `precipitate` operate on path potentials and composite labels.

A fresh single cell appears in the knowledge void because `settle` leaves it potential while `brim` raises the free negative side to stable.
