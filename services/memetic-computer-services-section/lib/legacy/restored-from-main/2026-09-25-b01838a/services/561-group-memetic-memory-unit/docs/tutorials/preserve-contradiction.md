# Preserve contradiction

This tutorial stores two memes at the same cell address.

The point is to see the memory boundary: the store keeps both memes instead of folding them.

## 1. Create one address

```ts
const cell = {
  subject: "sky",
  predicate: "blue",
  object: "sky"
};
```

## 2. Create two charges

```ts
import type { Meme } from "@561-group/meme";

const affirmed: Meme = {
  cell,
  charge: {
    value: [true, false],
    evidence: [["clear noon observation"], []]
  }
};

const denied: Meme = {
  cell,
  charge: {
    value: [false, true],
    evidence: [[], ["storm dusk observation"]]
  }
};
```

The two memes share an address but carry different evidence.

## 3. Store both

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";

const memory = new MemeStore();

memory.store(affirmed).store(denied);
```

## 4. Recall the raw evidence

```ts
const raw = memory.recall(cell);

console.log(raw.map((m) => m.charge.value));
// [[true, false], [false, true]]
```

The memory unit returns both memes, in store order.

It does not collapse the pair to `[true, true]`. It does not throw because the address has conflicting evidence. It does not decide which witness is more reliable.

## Complete example

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Meme } from "@561-group/meme";

const cell = {
  subject: "sky",
  predicate: "blue",
  object: "sky"
};

const affirmed: Meme = {
  cell,
  charge: { value: [true, false], evidence: [["clear noon observation"], []] }
};

const denied: Meme = {
  cell,
  charge: { value: [false, true], evidence: [[], ["storm dusk observation"]] }
};

const memory = new MemeStore();

memory.store(affirmed).store(denied);

const raw = memory.recall(cell);

if (raw.length !== 2) {
  throw new Error("memory should preserve both witnesses");
}
```

## Next step

Read [Memory versus processing](../explanations/memory-versus-processing.md) for the package boundary behind this behavior.
