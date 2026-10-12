# Store and recall a meme

This tutorial creates a `MemeStore`, stores one meme, and recalls it by address.

## 1. Import the memory unit and the shared meme type

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Meme } from "@561-group/meme";
```

`MemeStore` is the runtime class. `Meme` is the shared vocabulary type from `@561-group/meme`.

## 2. Create a meme

```ts
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

The cell is the address. The charge is the evidence-bearing word stored at that address.

## 3. Store it

```ts
const memory = new MemeStore();

memory.store(meme);
```

`store` appends the meme and returns the store, so calls can be chained.

## 4. Recall it

```ts
const recalled = memory.recall({
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
});

console.log(recalled.length); // 1
console.log(recalled[0]);     // the original meme
```

Recall returns an array because memory can hold more than one meme at the same address.

## Complete example

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
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

const memory = new MemeStore();

memory.store(meme);

const recalled = memory.recall(meme.cell);

if (recalled.length !== 1) {
  throw new Error("expected one stored meme");
}

console.log(recalled[0]?.cell.predicate);
```

## Next step

Read [Preserve contradiction](preserve-contradiction.md) to see why recall returns a list rather than one settled value.
