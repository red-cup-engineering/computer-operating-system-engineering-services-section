# Invariants

These are the behaviors documentation and downstream packages may rely on.

## Storage is append-only

Calling `store(meme)` increases `size` by one. It does not replace, merge, or delete any prior meme.

## Recall is address-based

Calling `recall(address)` returns only memes whose `cell` matches the requested address by the store's structural address key.

## Recall order is store order

For a given address, recalled memes appear in the order they were stored.

## Raw memes are preserved

The store does not rewrite cells, charges, or evidence arrays. It returns the stored meme objects.

## Contradiction is preserved

If one meme at an address has charge `[true, false]` and another has `[false, true]`, memory keeps both. Any fold to `[true, true]` belongs to a processing unit.

## Empty recall is empty array

A missing address recalls as `[]`, not `null`, `undefined`, or an error.

## `size` counts memes

`size` is the total number of stored memes, not the number of distinct addresses.

## `cells()` lists distinct addresses

`cells()` returns one address per structural address key, in the order each address first appeared.

## `memes` is a shallow array copy

Pushing to the array returned by `memes` does not mutate the store. The meme objects inside the returned array are not deep copies.

## Memory is ephemeral

The package has no persistence. A new `MemeStore` starts empty.
