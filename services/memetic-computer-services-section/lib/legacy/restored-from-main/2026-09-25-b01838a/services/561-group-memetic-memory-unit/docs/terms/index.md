# Terms

## Address

The cell used to recall memes from memory. In this package, `Address` is `Meme["cell"]`.

## Accretive

Append-only. Storing new evidence adds another meme to the log rather than replacing an older one.

## Cell

The relational identity of a meme: `{ subject, predicate, object }`, read as `subject —predicate→ object`.

## Charge

The four-valued evidential word attached to a cell. A charge has two boolean marks and two evidence slots.

## Contradiction

Two-sided evidence at the same address. Memory preserves contradiction as stored evidence rather than treating it as malformed data.

## Evidence

The witness material carried inside a charge. Memory treats evidence as payload and does not interpret it.

## Fold

A processing operation that combines multiple charges or witnesses into a settled value. The memory unit does not fold.

## Log

The private in-memory sequence of stored memes inside a `MemeStore`.

## Meme

The irreducible thing-with-evidence: a `cell` paired with a `charge`.

## MemeStore

The class exported by this package. It stores memes, recalls memes by address, and exposes small inspection helpers.

## MMU

Memetic Memory Unit. The package role: hold raw memes in memory.

## MPU

Memetic Processing Unit. A separate role: compute over recalled memes, including folding or settling.

## Raw

Unprocessed and unchanged by memory. A raw recalled meme is the same object that was stored.

## Recall

The read operation: return all memes stored at a requested address.

## Settle

A processing operation that draws conclusions from evidence. Settlement is outside this package.

## Store

The write operation: append a meme to the memory log.
