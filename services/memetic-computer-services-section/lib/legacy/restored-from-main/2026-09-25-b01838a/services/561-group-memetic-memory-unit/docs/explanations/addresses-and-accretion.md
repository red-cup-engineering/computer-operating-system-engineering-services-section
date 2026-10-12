# Addresses and accretion

`MemeStore` is organized around cell addresses.

An address is the identity half of a `Meme`:

```ts
import type { Address } from "@561-group/memetic-memory-unit";

const address: Address = {
  subject: "elderberry",
  predicate: "grows-near",
  object: "wetland-edge"
};
```

Read the address as a directed predication:

```txt
elderberry —grows-near→ wetland-edge
```

Subject and object are not interchangeable. A relation from `elderberry` to `wetland-edge` is not the same address as a relation from `wetland-edge` to `elderberry`.

## Structural address matching

The store compares addresses by a structural key derived from the three address fields. That means two different object identities can still recall together if their address fields serialize the same way.

```ts
memory.store({
  cell: { subject: "a", predicate: "p", object: "b" },
  charge: { value: [true, false], evidence: [["one"], []] }
});

memory.recall({ subject: "a", predicate: "p", object: "b" }); // finds it
```

For address components, prefer stable primitive values or JSON-like values. Object property order and JSON serialization matter. Cyclic object values are not good address components.

## Accretive storage

Storage is accretive: `store(meme)` appends and never overwrites.

If the same address is witnessed three times, the log has three entries:

```txt
1. a —p→ b : first charge
2. a —p→ b : second charge
3. a —p→ b : third charge
```

`recall({ subject: "a", predicate: "p", object: "b" })` returns all three, in first-stored order.

## Distinct cells

`cells()` returns the distinct addresses present in memory, also in first-stored order.

If three memes are stored at address A and one meme is stored at address B, `size` is `4`, while `cells().length` is `2`.

That distinction is important: memory counts stored evidence, not settled conclusions.
