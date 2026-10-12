# Create a meme

This tutorial creates a `Meme` value directly.

A `Meme` is a cell paired with a charge:

```ts
import type { Meme } from "@561-group/meme";

const meme: Meme = {
  cell: {
    subject: "elderberry",
    predicate: "grows-near",
    object: "wetland-edge"
  },
  charge: {
    value: [true, false],
    evidence: [["field note"], []]
  }
};
```

## 1. Choose the cell address

The cell says what the meme is about.

```ts
const cell = {
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
} as const;
```

Read this as:

```txt
elderberry —grows-near→ wetland-edge
```

Do not treat subject and object as interchangeable. This package preserves orientation.

## 2. Choose the charge

The charge says what evidential state is currently held at that address.

```ts
const charge = {
  value: [true, false],
  evidence: [["field note"], []]
} as const;
```

`[true, false]` is the `potential` phase: positive mark present, negative mark absent.

The evidence slots follow the same order as the value marks:

```txt
[positiveEvidence, negativeEvidence]
```

## 3. Pair them

```ts
import type { Meme } from "@561-group/meme";

const meme: Meme = { cell, charge };
```

Now the value can be passed to any package that consumes the shared `Meme` vocabulary.

## 4. Guard unknown data

The package exports `isMeme` for shallow structural checking:

```ts
import { isMeme } from "@561-group/meme";

export function acceptUnknown(input: unknown): Meme {
  if (!isMeme(input)) {
    throw new Error("Expected a Meme");
  }

  return input;
}
```

`isMeme` checks that the value has a structurally valid `cell` and `charge`. It does not validate the semantic meaning of your entity or predicate values.

For untrusted JSON at a boundary, use the JSON Schema instead of relying only on the type guard.

## Complete example

```ts
import type { Meme } from "@561-group/meme";
import { isMeme } from "@561-group/meme";

const candidate: unknown = {
  cell: {
    subject: "elderberry",
    predicate: "grows-near",
    object: "wetland-edge"
  },
  charge: {
    value: [true, false],
    evidence: [["field note"], []]
  }
};

if (isMeme(candidate)) {
  const meme: Meme = candidate;
  console.log(meme.cell.predicate);
}
```

## Next step

Read [Write a descent stub](write-a-descent-stub.md) to see how the morphism types can be used while building a runtime package.
