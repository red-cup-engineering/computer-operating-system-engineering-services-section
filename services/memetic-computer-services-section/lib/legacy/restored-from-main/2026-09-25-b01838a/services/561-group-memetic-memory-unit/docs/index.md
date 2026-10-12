# Documentation

This directory documents `@561-group/memetic-memory-unit`, the in-memory `MemeStore` package for the memetic workspace.

The package is small on purpose. It stores `Meme` values and recalls them by cell address. It does not fold, settle, validate, deduplicate, or persist them.

## Start here

Read these in order if you are new to the package:

1. [Memory versus processing](explanations/memory-versus-processing.md)
2. [Addresses and accretion](explanations/addresses-and-accretion.md)
3. [Store and recall a meme](tutorials/store-and-recall-a-meme.md)
4. [Use `MemeStore`](guides/using-memestore.md)
5. [API reference](references/api.md)

## Explanations

Explanations describe the model and why the package is shaped this way.

- [Memory versus processing](explanations/memory-versus-processing.md)
- [Addresses and accretion](explanations/addresses-and-accretion.md)

## Tutorials

Tutorials are small, concrete walkthroughs.

- [Store and recall a meme](tutorials/store-and-recall-a-meme.md)
- [Preserve contradiction](tutorials/preserve-contradiction.md)

## Guides

Guides describe how to use the package correctly inside another package.

- [Using `MemeStore`](guides/using-memestore.md)
- [Package boundaries](guides/package-boundaries.md)

## References

References list public surfaces and required behavior.

- [API reference](references/api.md)
- [Invariants](references/invariants.md)

## Terms

- [Glossary](terms/index.md)
