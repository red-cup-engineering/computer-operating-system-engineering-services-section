# LAGOON on a machine that has no systemd and is not always there

Status: specification, 2026-10-15. Requirement: `lagoon-receives-a-machine-that-comes-and-goes` (561-group/soft-grass-pebble, content/requirements). Raised by the Leader, 2026-10-15: "get a fresh LAGOON installed on your system, help LAGOON cope with intermittent machines".

## Facts this rests on (read 2026-10-15)
- Today LAGOON emits `.guix-systemd` only (`src/guix-deployment.scm`) and activates only through `systemctl --user` and `systemd-run` (`scripts/guix-deployment.scm`: `systemctl`, `units`, `unit-path`, `activate`, `restore-activation`, `wait-units`, `healthy?`). README: "The existing systemd user manager continues to supervise applications on a foreign Linux host."
- Soft Grass Pebble's carrier is a Claude Code cloud container whose PID 1 is not systemd; its `machine.json` declares `supervisor: shepherd`, and `deployment/presence.json` declares `known-intermittent`: absence is its ordinary state, HTTPS is send-only, nothing survives a pause or reclaim except the setup snapshot.
- red-cup-engineering/guix-machine-release-service already realizes the same deployment for GNU Shepherd: a `.guix-shepherd/NAME-561-group.scm` generation (`src/guix-deployment.scm`, main service plus simple auxiliaries, environment files re-read at every start, `make-forkexec-constructor`), a receiver keyed on `machine.json` `supervisor` (`scripts/receive.scm`: `shepherd?`, `herd load`), and `scripts/ephemeral-boot.sh` (Guix daemon without systemd, Shepherd from the pinned channel, private state, node key from the environment). The Leader's rule `production-uses-guix-pnpm-and-the-house-registry` says repair missing capability at its owner and keep no parallel controller machinery. LAGOON is the owner; the controller is a donor.

## Design
1. **One supervisor declaration.** `enterprise-deployment` gains `#:supervisor` (`'systemd-user`, the default and today's behaviour byte for byte, or `'shepherd`). The output keeps `.guix-systemd` for systemd targets and adds `.guix-shepherd/NAME-561-group.scm` for Shepherd targets, serialized in `deployment.scm` beside the existing layout so the receiver reads the supervisor from the sealed output, never from a caller argument.
2. **A supervisor record in `scripts/guix-deployment.scm`.** The functions that call `systemctl`/`systemd-run` (`stop-unit`, `enabled-state`, `disable-unit`, the `activate` start/restart/enable steps, `wait-units`, the checks runner, `healthy?`'s unit probe) are reached through one record of operations (`active-state`, `enabled-state`, `stop`, `disable`, `restart`, `enable`, `run-check`, `reload`, `unit-file`). The systemd record is the existing code moved, not rewritten. The Shepherd record maps them to `herd -s SOCKET status/stop/restart/load root`.
3. **Shepherd subset, refused loudly outside it.** Under Shepherd LAGOON receives the main service and simple auxiliaries. It refuses, before any host file changes, timers, oneshot units, `state-check`, `first-cutover`, `retirement-lock` and `drain-units`: these have no Shepherd form yet (the controller refuses the same set). A refusal is a receipt, not a half deployment.
4. **Rollback and recovery** use the same native Guix generation and the same host-file backup; only the final "re-register the held generation's service file" differs.
5. **Intermittence.**
   - *Idempotent return*: `deploy` of the generation already live and healthy is a no-op that prints the store path; every boot may call it.
   - *No standing runner*: the target is built and received on the machine itself (`build` then `deploy`, or `receive` of an imported closure) from a controller checked out at the pinned commit; nothing waits on a runner that is not there.
   - *Held, not failed*: a receipt records `away` when the only failure is that a peer or the registry did not answer; a refusal or a failed health read is `failed`. (Matches `presence.json` readings: silence is unknown, never refused.)
   - *Identity survives*: the node key is taken from the environment or the credential store and is never regenerated silently; LAGOON refuses to receive a machine whose declared peer key differs from the one in state.
6. **Ephemeral boot moves with it.** `scripts/ephemeral-boot.sh` stages (Guix daemon without systemd, pinned Shepherd, registries, private state) become LAGOON's `scripts/` with their tests; guix-machine-release-service keeps nothing LAGOON owns and its README points here.

## Tests (before code is trusted)
- systemd path: existing suites unchanged and green (`guile scripts/run-node-worker-tests.scm`, `node --test test/*.test.mjs`).
- Shepherd path: generation of `.guix-shepherd/*.scm` for a fixture machine; receive under a real `shepherd` in a scratch socket; rollback restores the held service; refusals for timers, first-cutover, state-check.
- Intermittence: second `deploy` of a live generation changes nothing; a registry that does not answer yields `away`, a refused one `failed`.

## Not decided here
Whether `away` is a receipt field or a separate record; whether the node-key check belongs in LAGOON or in the credential custody service (the founding note leaves durable key custody open).
