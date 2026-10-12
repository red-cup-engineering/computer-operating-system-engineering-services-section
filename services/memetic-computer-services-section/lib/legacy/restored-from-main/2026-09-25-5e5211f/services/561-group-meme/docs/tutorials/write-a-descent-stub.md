# Write a descent stub

This tutorial shows how another package can use the morphism types exported by `@561-group/meme` while implementing its own runtime behavior.

The package exports type signatures for the descent pipeline:

```ts
import type {
  Articulate,
  Predicate,
  Posit,
  Settle
} from "@561-group/meme";
```

These are function types only. They do not come with implementations.

## 1. Implement `Articulate`

`Articulate` turns an utterance into a bit.

```ts
import type { Articulate } from "@561-group/meme";

export const articulate: Articulate = (utterance) => ({
  carrier: utterance,
  slots: [[], []]
});
```

A fresh bit starts with both slots empty. That is the `absurd` phase: no witnesses have been placed into either slot.

## 2. Stub `Predicate`

`Predicate` turns a bit into a predicated structure.

```ts
import type { Predicate } from "@561-group/meme";

export const predicate: Predicate = (bit) => {
  const [token, claim] = bit.carrier;

  const entitySet = { entities: [token] };
  const predicateSet = { predicates: [claim] };

  return {
    "cell-set": {
      "entity-set": entitySet,
      "predicate-set": predicateSet
    },
    fiber: {
      "cell-set": {
        "entity-set": entitySet,
        "predicate-set": predicateSet
      },
      base: {
        objects: { token, claim },
        specialization: [],
        converse: [],
        "subject-projection": [],
        "object-projection": []
      },
      "entity-set": entitySet
    }
  };
};
```

This is only a stub. A real predicate implementation should decide how tokens and claims expand into entity sets, predicate sets, base objects, and morphism slots.

## 3. Stub `Posit`

`Posit` creates a presheaf and traces.

```ts
import type { Posit } from "@561-group/meme";

export const posit: Posit = (predicated) => {
  const entitySet = predicated.fiber["entity-set"];

  return {
    presheaf: {
      fiber: predicated.fiber,
      base: predicated.fiber.base,
      "entity-set": entitySet,
      fibers: []
    },
    traces: []
  };
};
```

A real posit implementation should seed cells with knowledge-least charges and produce whatever initial traces the processing package needs.

## 4. Stub `Settle`

`Settle` turns a posited structure into a sheaf.

```ts
import type { Settle } from "@561-group/meme";

export const settle: Settle = (posited) => ({
  base: posited.presheaf.base,
  section: {
    base: posited.presheaf.base,
    "fiber-algebras": posited.presheaf.fibers
  }
});
```

A real settle implementation should iterate knowledge closure to its fixed point.

## 5. Compose the stubs

```ts
import type { Utterance } from "@561-group/meme";

const utterance: Utterance = ["elderberry", "grows-near"];

const bit = articulate(utterance);
const predicated = predicate(bit);
const posited = posit(predicated);
const sheaf = settle(posited);

console.log(sheaf.section["fiber-algebras"]);
```

## What this tutorial proves

The morphism types are useful even before the runtime is complete. They let a processing package type-check the boundaries between descent phases while keeping implementation policy outside `@561-group/meme`.

## What this tutorial does not prove

These stubs do not perform real closure, real predication, real seeding, or real settling. They only demonstrate the shape of the pipeline.
