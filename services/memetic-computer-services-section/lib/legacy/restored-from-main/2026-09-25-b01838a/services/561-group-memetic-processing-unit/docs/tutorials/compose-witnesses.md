# Compose witnesses

This tutorial uses the functional `compose` API.

Use `compose` when you already have witness tuples and want a settled `Sheaf` without creating an `Mpu` instance.

## 1. Import the helpers

```ts
import {
  compose,
  chargeAt,
  memeChargeOf
} from "@561-group/memetic-processing-unit";
```

## 2. Write witness tuples

A witness tuple has one of four forms:

```ts
type Witness =
  | readonly [subject: unknown, claim: unknown]
  | readonly [subject: unknown, claim: unknown, denied: false]
  | readonly [subject: unknown, claim: unknown, object: unknown]
  | readonly [subject: unknown, claim: unknown, object: unknown, denied: false];
```

Examples:

```ts
const witnesses = [
  ["socrates", "mortal"],
  ["plato", "mortal"],
  ["sky", "blue"],
  ["sky", "blue", false],
  ["alice", "home", "cottage"],
  ["alice", "likes", "noise", false]
] as const;
```

## 3. Compose the section

```ts
const sheaf = compose(witnesses);
const section = sheaf.section;
```

The result is a `Sheaf`. Its section is a valuation with one fiber-algebra per predicate.

```ts
const predicates = section["fiber-algebras"].map((fa) => fa.predicate);
console.log(predicates);
```

## 4. Read a cell charge

```ts
const charge = chargeAt(section, {
  subject: "sky",
  predicate: "blue",
  object: "sky"
});

console.log(memeChargeOf(charge)); // "stable"
```

The cell is stable because the witnesses include both an affirmation and a denial.

## 5. Read absent cells

`chargeAt` returns `bottom()` for cells that were never witnessed.

```ts
const absent = chargeAt(section, {
  subject: "nobody",
  predicate: "nothing",
  object: "nobody"
});

console.log(memeChargeOf(absent)); // "absurd"
```

## 6. Understand object defaults

Two-item and three-item denial tuples are self-referential:

```ts
["sky", "blue"]
// cell: { subject: "sky", predicate: "blue", object: "sky" }

["sky", "blue", false]
// same cell, denied
```

Explicit-object tuples use the third value as object:

```ts
["alice", "home", "cottage"]
// cell: { subject: "alice", predicate: "home", object: "cottage" }

["alice", "home", "cottage", false]
// same explicit-object cell, denied
```

`false` is reserved as the denial marker in the third or fourth position. Do not use bare `false` as an explicit object value in this tuple API.

## 7. Inspect base edges

`compose` also builds a base category.

Each witness contributes a specialization edge from claim to subject:

```ts
const sheaf = compose([
  ["socrates", "mortal"],
  ["plato", "mortal"],
  ["socrates", "wise"]
]);

console.log(sheaf.section.base.specialization);
// [
//   { source: "mortal", target: "socrates" },
//   { source: "mortal", target: "plato" },
//   { source: "wise", target: "socrates" }
// ]
```

## 8. Folded evidence

When multiple witnesses target the same cell, their charges fold by knowledge join.

```ts
const sheaf = compose([
  ["sky", "blue"],
  ["sky", "blue", false]
]);

const charge = chargeAt(sheaf.section, {
  subject: "sky",
  predicate: "blue",
  object: "sky"
});

console.log(charge.value);    // [true, true]
console.log(charge.evidence); // [["sky"], ["sky"]]
```

The two evidence sides remain available for audit.

## Complete example

```ts
import { compose, chargeAt, memeChargeOf, compare } from "@561-group/memetic-processing-unit";

const sheaf = compose([
  ["socrates", "mortal"],
  ["plato", "mortal"],
  ["sky", "blue"],
  ["sky", "blue", false],
  ["alice", "home", "cottage"],
  ["alice", "likes", "noise", false]
]);

const section = sheaf.section;

const skyBlue = chargeAt(section, {
  subject: "sky",
  predicate: "blue",
  object: "sky"
});

console.log(memeChargeOf(skyBlue)); // stable

const { consistent, paraconsistent } = compare(section);
console.log(consistent);
console.log(paraconsistent);
```

## Next step

Import `@lenticule-science/metrologic/closure` if you want to work with closure ordinals directly.
