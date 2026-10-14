# computer-deployment-engine

**LAGOON** is the deployment and production system for the engines,
servers, clients, platforms, and applications in this ecosystem. It uses
GNU Guix for immutable construction and native profile generations. It operates
over the same unnetworked [JSNode Hoare engine](../../../../../../../../content/text/glossary/terms/jsnode-hoare-engine.md)
as FeltOS and MARSH.

This package is LAGOON's home under rule 2 (a thing about running a
system X lives under computer-systems-engineering in
computer-X-system-services-section/apps/computer-X-engine): the system X
here is deployment, so LAGOON lives at
computer-operating-system-services-section/apps/computer-deployment-engine.

## Foreign-host applications

The existing systemd user manager continues to supervise applications on a
foreign Linux host. LAGOON does not reconfigure that host as a Guix System.
Guix System machines use Guix's own system/deploy facilities.

Run the existing entry with the target's pinned channels:

```sh
guix time-machine -C CHANNELS -- repl -- scripts/guix-deployment.scm \
  build CHANNELS LOAD-PATH DEFINITION PACKED-RUNTIME RESULT-ROOT
```

The `deploy` form takes the same arguments, replacing `RESULT-ROOT` with the
absolute application profile. `rollback CHANNELS PROFILE` selects the preceding
native Guix generation and activates its declared services. Prepared runtime
bytes come from the recursive recorded workspace, frozen root pnpm install,
actual source generation, and native pnpm packing. No release receipt inputs
are accepted.

The bounded initial state conversion uses `deploy ... PROFILE --first-cutover
WORK`; its historical converter is an exact pinned source declared by the
target, included only in that variant. `build ... ROOT --first-cutover` builds
that variant without activating it. Ordinary deployment validates current
state through its current owner and requires the configured application to
match the native profile. Initial conversion stops admission, waits for live
jobs, and keeps originals. A failed conversion cannot restart incompatible old
writers after new durable state or queued work has changed.

Before host files change, LAGOON durably saves their actual bytes, symlinks,
Guix generation and supervisor intent. If interrupted, use
`recover CHANNELS PROFILE BACKUP` with the printed private backup directory.
It uses the same restoration operation as a caught deployment failure.
Successful first-cutover backups remain available; an old pre-LAGOON output
cannot be activated by the ordinary rollback command alone. Native Guix
history is retained; LAGOON does not prune generations or maintain a separate
current/previous release selector.

