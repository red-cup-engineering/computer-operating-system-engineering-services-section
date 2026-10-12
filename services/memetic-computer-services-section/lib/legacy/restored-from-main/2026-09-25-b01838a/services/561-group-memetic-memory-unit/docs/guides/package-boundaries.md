# Package boundaries

`@561-group/memetic-memory-unit` sits between the shared vocabulary package and higher-level runtime packages.

```txt
@561-group/meme
    defines Cell, Charge, Meme, guards, schemas
        │
        ▼
@561-group/memetic-memory-unit
    stores and recalls raw Meme values
        │
        ▼
processing / persistence / pathing packages
    settle, write, index, route, or compute over recalled values
```

## Boundary with `@561-group/meme`

`@561-group/meme` owns the data vocabulary. It defines `Cell`, `Charge`, and `Meme`.

The memory unit imports `Meme` as a type and aliases `Address` to `Meme["cell"]`. It does not redefine the vocabulary.

## Boundary with a processing unit

A processing unit may fold multiple recalled memes, negate a charge, settle a cell, or compute over a collection of cells.

The memory unit does none of those things. It does not know which charge wins, whether two witnesses should be merged, or what a contradiction means.

The tests demonstrate interop by storing a meme produced by the processing unit, but that runtime import belongs to the test file, not the memory unit itself.

## Boundary with persistence

This package has no disk behavior. It does not save, load, serialize, rotate, or compact logs.

A persistence unit can use `memory.memes` as a snapshot source, but once bytes are being written or read, the work has crossed out of this package.

## Boundary with indexing

The current implementation scans its private log when recalling, checking, or listing cells. That is appropriate for a tiny memory unit.

If a future package needs large-scale indexing, secondary indexes, or query planning, that should be designed as an additional unit or a carefully justified extension. Do not smuggle a database into `MemeStore` without changing the package story.
