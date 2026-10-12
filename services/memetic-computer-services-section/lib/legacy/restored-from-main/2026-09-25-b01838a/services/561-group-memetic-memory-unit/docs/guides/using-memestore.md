# Using `MemeStore`

Use `MemeStore` when a package needs a small, local memory of raw `Meme` values.

## Import from the package root

```ts
import { MemeStore } from "@561-group/memetic-memory-unit";
import type { Address } from "@561-group/memetic-memory-unit";
import type { Meme } from "@561-group/meme";
```

The public package root exports `MemeStore` and the `Address` type. The `Meme` type comes from `@561-group/meme`.

## Validate before storing unknown data

`MemeStore` does not validate its input. If a value crosses a JSON, network, file, or plugin boundary, check it before storing.

```ts
import { isMeme } from "@561-group/meme";
import { MemeStore } from "@561-group/memetic-memory-unit";

export function storeUnknown(memory: MemeStore, input: unknown): void {
  if (!isMeme(input)) {
    throw new Error("Expected a Meme");
  }

  memory.store(input);
}
```

For stricter boundary validation, use the JSON Schemas from `@561-group/meme`.

## Design stable addresses

The store recalls by structural address key. Prefer simple, stable address components:

```ts
const address: Address = {
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
};
```

Avoid using cyclic objects as address components. Be careful with rich objects whose JSON representation may change as properties are inserted, removed, or reordered.

## Treat returned arrays as snapshots

`recall(address)` and `memes` return new arrays. Mutating those arrays will not append to or delete from memory.

The contained meme objects are not deep-cloned or frozen. Treat stored memes as immutable values by convention.

## Keep processing out of memory

A good use looks like this:

```ts
const raw = memory.recall(address);
const settled = processingUnit.settle(raw);
```

A bad use puts settlement logic inside the store:

```ts
// Do not add this responsibility to MemeStore.
const settled = memory.recallAndSettle(address);
```

When a feature needs to decide what a charge means, place it in a processing package. When a feature needs to write the log somewhere durable, place it in a persistence package.
