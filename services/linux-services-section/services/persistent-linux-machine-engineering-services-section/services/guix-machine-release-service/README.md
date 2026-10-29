# Guix machine release service (moved)

The release controller lives in its own repository,
[red-cup-engineering/guix-machine-release-service](https://github.com/red-cup-engineering/guix-machine-release-service).
This machine's release workflow resolves it from there through the `owners` map in the MetroPlat
machine's `sources.json`; nothing resolved this directory.

The copy that stood here matched the canonical controller as of its pull request #33. Everything it held is
in the canonical repository, which has since added release retention (`scripts/release-retention.mjs`).
Its history remains in this repository's Git log. Removing its `package.json` also drops a second
`@red-cup-engineering/guix-machine-release-service` workspace member from this repository's pnpm workspace.
