# Memetic computer services section

The June 2026 generation of the 561 Group computer's native language and its substrate,
brought into the tree from six GitHub repositories on 2026-08-27.

This is the *second* Horsetail. The first — a JavaScript Fennel on the bilattice/Chu
substrate — is the sibling `561-group-horsetail` one level up. This one is the TypeScript
Scheme that the founding commit actually promised ("the computer's C/Scheme-equivalent"),
begun the day after `computer/` was archived "ahead of repopulating from the new layout".
It is that repopulation. See
[the note on the two lineages](../../../../content/text/documents/articles/notes/2026/08/27/2026-08-27-note-on-the-two-horsetail-lineages.md).

## This is the Horsetail

There is one. `services/561-group-horsetail` holds `@561-group/horsetail`, and no other package in
the tree carries that name. `tsander` runs its unit flight-computers on it.

The predecessor — a JavaScript Fennel recovered from git history earlier the same day — was deleted
once this one took over. It was a second implementation of the same language, and keeping it meant
keeping two. What it carried that was *not* language moved to where such things belong:
`principal`, `process-runtime`, and `typed-filepath-addressing-system` are now tiles of
`@561-group/computer` (0.0.5), alongside `distribution`. Its `as` and `federate` implementations
remain readable in git history, which is where a superseded implementation belongs.

## Provenance

Every package is checked out at its own contemporary commit, not at HEAD. Five of the six
carry the *identical* commit message on the same day — one cross-repo save, and the moment
the work stopped:

```text
561-group-horsetail                 emsenn/horsetail                  5b2838a  2026-06-08
561-group-memetic-processing-unit   emsenn/memetic-processing-unit    1808763  2026-06-08
561-group-memetic-memory-unit       emsenn/memetic-memory-unit        17031bf  2026-06-08
561-group-proof-pathing             emsenn/proof-pathing              dcb26c3  2026-06-08
561-group-memetics                  emsenn/memetics                   8e93a55  2026-06-08
561-group-meme                      emsenn/meme                       ddd15ea  2026-06-07
```

Taking any of them at HEAD instead breaks the language: on 2026-06-09, the day after this
snapshot, the processing unit committed "refactor mpu processing vocabulary" and later moved
to `dist` builds under a renamed `@emsenn/*` scope. Horsetail never followed. `claimsFor`,
which its evaluator calls, exists at this snapshot and not at HEAD.

## No build step

At this snapshot every package is `noEmit` and exports `./src/*.ts` directly, consumed as
TypeScript source through Node's type stripping. There is nothing to compile. The `dist`
builds and the `../../scripts/package-boundary/` helper referenced by later `build` scripts
are additions from after this generation and do not apply to it — a `build` script here will
fail for want of a `tsconfig.build.json` that did not yet exist.

Inter-package dependencies were rewritten from registry pins to `file:` siblings on the way
in; nothing here is published to Verdaccio.

## Verification

From `services/561-group-horsetail`:

```sh
npm install
npm test    # 127 tests, 127 pass
npm run check   # tsc --noEmit, clean
```

`561-group-memetics` is a type-only dependency of horsetail, so the language runs without it
and needs it only to typecheck.

## What is not done

`as` and `federate` are the two special forms this Horsetail lacks. Both bind to OS tiles, and both
tiles are now in `@561-group/computer` 0.0.5 — `principal` and `distribution/federate`. The
predecessor's implementations of both are in git history at `b0b7906b875~1`, and its `federate` ran
against real federated worlds in `tsander`, so the ports can be diffed against recorded behaviour
rather than guessed.
