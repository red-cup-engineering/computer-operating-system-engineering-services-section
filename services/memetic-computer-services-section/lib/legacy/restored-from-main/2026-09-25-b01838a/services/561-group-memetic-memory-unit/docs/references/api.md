# API reference

The public package root is `@561-group/memetic-memory-unit`.

```ts
export { MemeStore } from "./meme-store.ts";
export type { Address } from "./meme-store.ts";
```

## `Address`

```ts
type Address = Meme["cell"];
```

An `Address` is the cell half of a `Meme`: `{ subject, predicate, object }`.

## `MemeStore`

```ts
class MemeStore {
  store(meme: Meme): this;
  recall(address: Address): Meme[];
  has(address: Address): boolean;
  cells(): Address[];
  get size(): number;
  get memes(): readonly Meme[];
}
```

### `store(meme): this`

Appends `meme` to the private in-memory log and returns the store.

Behavior:

- does not overwrite existing memes;
- does not deduplicate by address or value;
- does not validate the input;
- does not clone or freeze the meme;
- does not compute the address key during storage.

### `recall(address): Meme[]`

Returns every stored meme whose `cell` matches `address` by the store's structural address key.

Behavior:

- returns a new array;
- preserves first-stored order;
- returns raw stored meme objects;
- returns an empty array if no meme is stored at the address;
- does not fold, settle, merge, or sort charges.

### `has(address): boolean`

Returns `true` if at least one stored meme matches `address`.

### `cells(): Address[]`

Returns the distinct cell addresses present in memory, in first-stored order.

If several memes share an address, the returned address is the first stored address object for that structural address key.

### `size: number`

The number of memes stored in the log.

This counts memes, not distinct cells.

### `memes: readonly Meme[]`

A shallow copy of the stored meme log, in first-stored order.

The returned array is a copy, but the meme objects inside it are the stored object references.

## Address key behavior

Address matching is structural. The implementation builds a key from `subject`, `predicate`, and `object`.

Primitive address components are prefixed by their JavaScript type. Non-null objects are serialized with `JSON.stringify`.

Implications:

- stable strings, numbers, booleans, symbols, bigints, and nulls are straightforward address components;
- JSON-like objects can work when their serialized form is stable;
- object property order matters because JSON serialization matters;
- cyclic objects are not suitable address components;
- `Map`, `Set`, class instances, and other rich objects may serialize in surprising ways.

Prefer stable primitive or JSON-like address values.
