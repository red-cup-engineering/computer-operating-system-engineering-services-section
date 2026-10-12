# Memory versus processing

`@561-group/memetic-memory-unit` exists to keep one boundary clean:

```txt
memory keeps evidence
processing draws conclusions
```

The `MemeStore` is memory. It accepts a `Meme`, appends it to an in-memory log, and later returns the memes stored at a requested cell address. That is the whole job.

## Why memory does not settle

A meme is a thing-with-evidence: a `cell` plus a `charge`.

The `cell` says what the meme is about:

```txt
subject —predicate→ object
```

The `charge` says what evidential word is currently attached to that address. The charge can hold one side, the other side, neither side, or both sides.

When memory sees two memes at the same address, it does not decide which one wins. It keeps both.

```txt
sky —blue→ sky : [true, false]
sky —blue→ sky : [false, true]
```

Those two stored memes may later settle to a two-sided value in a processing unit. The memory unit does not do that fold. It preserves the raw witnesses so another unit can make the settlement explicit.

## What the boundary buys

Keeping memory separate from processing makes several things easier to reason about:

- storage is lossless by default;
- recall order is visible and testable;
- contradictions are data, not exceptions;
- settlement can be changed without rewriting memory;
- persistence can be added without changing processing.

The result is a boring but useful part: `store` appends, `recall` reads.

## Not a validator

`MemeStore` assumes callers pass valid `Meme` values. It does not call `isMeme`, use JSON Schema, or inspect the semantic meaning of a subject, predicate, object, or charge.

Validate unknown data at the boundary before storing it.

## Not a database

The store is in memory only. It has no disk format, no transaction protocol, no concurrency control, and no query language. A persistence unit can be built around `memory.memes`, but persistence is not part of this package.
