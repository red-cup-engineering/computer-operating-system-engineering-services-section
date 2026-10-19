# WSL host service: design

## Theory

A WSL2 host is a Windows host running a Hyper-V virtual machine. Its configuration is split across the two sides of that boundary, and each side has its own file formats, privileges and reload semantics. The failures measured on Bare Cedar Fog (see the science note `2026-10-09-note-on-the-wsl2-host-failure-model.md` in computer science) are failures of resources that cross the boundary: swiotlb bounce buffers for storage, contiguous memory for vsock rings, the virtual NIC's segment offload, core dumps and the VHDX onto C:. A defence is therefore a coordinated setting on both sides, and it holds only if both sides are installed from one record. Held as scattered edits, the defences drift, which they did (finding list in the operations record).

## Shape

```
parameters (data, operations) --render--> files (pure) --plan--> state --apply--> host
                                                              \--> live observation
```

- `src/wsl-host.mjs`: pure renderers (`renderIni`, `renderSysctl`, `renderUdev`, `renderEnv`, unit renderers, PowerShell renderers), `renderFiles` (the whole file set), `planFiles` (compare), `observeLive` (kernel values), `windowsInstruction`, and `applyPlan` (write, back up, run hooks). Only `applyPlan` and `planFiles` touch the filesystem, through plain reads and writes.
- `scripts/wsl-host.mjs`: the command line, `plan` and `apply`, with `--scope=linux|windows|all` and `--root=<dir>` to stage the whole file set under a directory.
- `assets/`: the two Linux helper scripts (`wsl-orphan-relay-reaper.sh`, `wsl-agent-limits.sh`). Their behaviour is parameterized through arguments and the defaults file, never by editing them.

## Choices

- **Node built-ins only.** The repository's persistent-Linux-machine section normally reaches the filesystem through the house file services. This tool is the one that must work before any of that is installed, so it reads and writes directly. Everything else in the section that can use the house services should.
- **Comparison ignores CRLF and trailing whitespace.** Windows editors rewrite line endings; they are not drift.
- **Live reconciliation is part of apply.** Each live check declares its Linux or Windows scope and its existing reload hook. Apply unions changed-file hooks with mismatched managed-live hooks, requires root before either kind of Linux mutation, and runs each hook once. Current files can therefore repair live-only drift. The udev hook reloads the rule and restarts the existing bounded block-queue unit, receiving its two settled events. Kernel-command-line changes remain the host owner's Windows action. After applying, fresh scoped observations determine the terminal status; staging renders files without live hooks.
- **Restoration uses the declared budget.** Bare Cedar Fog's 2026-10-14 plan found an absent user.slice drop-in and sdd at 1267 requests while the sourced record declares 256. Applying the file received the memory budget; the live-only queue requires the same owned reload path. No new host values or resource limits are selected.
- **Windows is written, never executed.** `.wslconfig` takes effect at the next VM start and the Defender and pagefile scripts need elevation. The service writes the files from WSL and prints the one command; the owner decides the moment.
- **A separate boot-time unit for block queues.** The udev rule is kept (it is the correct statement of the limit and it works for hot-added disks), and `wsl-block-queue.service` re-sends a change event after boot, twice, 20 seconds apart, because a boot-time write is refused as busy on disks the kernel still holds.
- **Reaper timer.** The interval is a parameter (5 minutes on Bare Cedar Fog) and the unit passes the thresholds as arguments, so the script has no constants.
- **In-memory swap before disk swap (WSL-21).** The memory a busy guest can least afford to lose is file-backed: the interactive programs' executables and databases. With swap held small (the disk swap is a VHDX behind `hv_storvsc`), reclaim has nothing else to take. A `zram` device turns idle anonymous memory (editor and app-server heaps) into compressed pages in RAM, so a cgroup at its `memory.high` sheds heap before code. `wsl-zram-swap` creates it once per boot and leaves an active device alone. `disksize` bounds the uncompressed bytes it accepts and `mem_limit` bounds the RAM its pool may take; the budget counts `mem_limit`, because the pool is memory that no cgroup is charged for. The device takes priority above the disk swap, which stays as overflow. The algorithm is a record value because the WSL kernel builds only the LZO backends (2026-10-18: `CONFIG_ZRAM_BACKEND_ZSTD` is not set).
- **Targeted reclaim before a VM-wide drop (WSL-22).** WSL-20's ceiling exists to return memory to Windows, but `drop_caches` evicts every clean page, hot or cold, in every cgroup. `memory.reclaim` on a named cgroup evicts that cgroup's coldest pages first. The guard asks each named cgroup, in record order, for the excess (`swappiness=0`, so only cache), re-reads the cache after each, and falls back to the VM-wide drop only if the cache is still above the ceiling. Batch slices come first in the record and the interactive cgroup last.
- **Read-ahead is a block-queue attribute.** The root VHDX reports a large optimal I/O size, so the kernel sized its read-ahead at 8 MiB (2026-10-18). A fault on an evicted page of a mapped file reads around the fault by that window, so under memory pressure each refault can pull megabytes back in and evict more. `read_ahead_kb` is declared beside the queue depth and checked live like it.
- **The disk swap's I/O ceiling skips in-memory swap (WSL-23).** The helper picks the first swap device that is not `zram`; an in-memory device has no disk traffic to bound.
- **No MetroPlat operation wrapper yet.** MetroPlat may later offer `plan` as a monitored check. The service must not need it.

## Parameter record

`wsl-host-parameters@1`: `windows` (`profileMount`, `profileWindowsPath`, `wslConfig.sections`, `defender`, `pagefile`), `linux` (`wslConf.sections`, `sysctl[]`, `blockQueue`, `agentLimits`, `memoryBudget`, `headroomGuard` with optional `reclaimCgroups[]`, `zramSwap` {`description`, `disksize`, `memLimit`, `algorithm`, `priority`}, `relayReaper`), and free provenance fields (`observed-*`, `legacy`) that the renderers ignore.

## Backing-volume observation

The explicit `capacity --parameters=RECORD --destinations-json=ARRAY` command is
read-only and builtins-only. `observeBackingVolumeCapacity` checks an available
`WSL_DISTRO_NAME` hint and mandatory native `wslpath -w /`
distribution-root UNC witness, reads
only the declared Lxss registry key and exact VHDX through
the fixed owned PowerShell asset, and asks `Get-Volume -FilePath` for its real
backing volume. The record binds distribution name, registry key, base path,
VHD filename, volume ID and Linux mount; current device numbers are observed,
never persisted across boots. Every requested destination must map to that
mount's actual device. Unknown devices refuse rather than borrow root capacity.
Systemd user managers may omit WSL environment hints: absence is accepted only
with the same mandatory kernel, native UNC, registry, VHDX and volume proofs.
A present mismatching distro hint refuses. No caller environment is copied or
invented to repair a failed proof; unavailable native interoperability is unknown.
For a caller that already has native Windows interoperability, the existing
`systemd-run --user --scope` resource preserves that caller's process context
while applying cgroup and runtime bounds. A transient service instead starts
from the manager and may lack an interop ancestor. No session environment or
socket is copied to make such a service appear qualified.

The child has a finite deadline, a small output cap and no shell or caller-supplied
probe. Data enters the fixed script as base64 JSON. Freshness and every identity
are rechecked at the Node boundary. The result carries decimal byte strings and
operations-owned physical reserve/growth/overhead estimates. Available capacity
is the minimum of volume free space and the current Windows caller's quota-aware
`DriveInfo.AvailableFreeSpace`; an unsupported mounted-volume quota join refuses.
This does not assert arbitrary external storage quotas absent. Consumers sum
simultaneous guest-device peaks once per backing volume, retaining their ordinary
guest byte/inode gates. Observations are snapshots, not reservations.

This command neither enables sparse VHD nor trims, compacts, shuts down, changes
configuration or removes data. A non-sparse dynamic VHD does not automatically
shrink after guest deletion. Existing compaction rendering is not safe automatic
incident reclamation: it targets every distro and requires independent owner
maintenance admission and exact-disk scoping before use.

The prescribed ordinary `plan` also invokes this owned read port for the root
when the record declares it (outside staged or Linux-only plans). It reports
actual available bytes against max(physical percentage, minimum) + growth +
estimated overhead and exits 2 for low or unknown physical capacity. It never
routes that drift into apply hooks. Legacy records without the declaration retain
their old plan behavior; operators do not need a third health command.

References: Microsoft [WSL disk space](https://learn.microsoft.com/en-us/windows/wsl/disk-space),
[Get-Volume](https://learn.microsoft.com/en-us/powershell/module/storage/get-volume),
and [compact vdisk](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/compact-vdisk).
Carrier semantics: [systemd-run](https://www.freedesktop.org/software/systemd/man/systemd-run.html)
and original [WSL interop](https://github.com/microsoft/WSL/blob/master/doc/docs/technical-documentation/interop.md).

## Scoped offline maintenance proposal

This is the design and receiving contract for replacing the unsafe existing
compaction rendering; it is not an implemented carrier or maintenance admission.
The ordinary `plan`, `capacity` and `apply` boundaries remain unchanged. Until
the replacement is fabricated and independently received, the existing generated
`wsl-compact-disk.ps1` must not be used for incident reclamation.

### Target and authority

Reuse `windows.backingStorage`: distribution name, exact Lxss key, base path,
VHD filename, backing-volume ID and Linux mount. Keep the host's operations
record as their owner. Do not find a target by glob, directory census, newest
file, drive letter alone or another distribution's available space.

The maintenance Resource attaches to the existing host/work custody. It names
the parameter digest, original obligations and operation handles, checkpoint
witnesses, target tuple, observed owning Windows SID and registry hive, actual
administrator principal, exact qualified tool, finite allocation, Windows result
location, admission/reopening decision and accountable custodian. A data file,
a checkbox or a privileged token alone is not the owner's admission. A proposal
has no admission. Missing authority or an unreadable witness refuses effects.

Elevation may select a different Windows account. Its HKCU must never silently
replace the distribution owner's hive. Prove the owning SID from the existing
Windows binding and address that exact loaded owner hive, or refuse. Do not
derive a SID from a profile folder, copy a token, mount another hive or create
an administrative identity as a repair.

### Checkpoint and offline boundary

Before the custodian admits any stop, receive all affected original work:
source and human state, current GC/build/materialization handles and their
terminal outcomes, deployment leases and profiles, publication/composition
cursor and unknown Git/ref effects, credential/state custody, and this agent's
own handoff. These are exact owned subjects, not a new host census. Preserve
unknown outcomes and other custodians' deliberate holds.

Kernel freezer state does not survive a distribution stop. The observed
rebooted legacy deployment selector demonstrates why a frozen process receipt
is insufficient. An affected old selector or worker needs an independently
received durable boot/reentry gate before maintenance; main Wants, restart
policies and automatic desktop launches must not admit it during recovery.
Disabling enablement alone does not stop a Wanted unit. Do not promise to
re-freeze it after boot.

The selected DiskPart/attach-based compactor runs from an independently qualified
native Windows administrator session outside the affected distribution. This is
that adapter's privilege contract, not a claim that every Windows compaction API
requires elevation. A different CompactVirtualDisk adapter would need its own
source/native qualification and caller-context authority; none is selected here. It performs no
`wsl --shutdown`, termination, distribution launch or restart. The owner first
admits the affected-work checkpoint, then arranges the exact disk's offline
state through the existing maintenance resource. A distribution-scoped stop
does not prove disk detachment. If the disk cannot be proved detached/read-only,
refuse; shared-VM maintenance needs its own explicitly received affected scope,
never an automatic escalation to shutting down every distribution.

### One disk operation and original result

Before its single operation, join the owner hive's current registration to the
same exact canonical VHDX, reject redirected/reparse targets, obtain its native
file identity and backing volume, and prove its eligible dynamic/offline state.
Revalidate against the captured identity at the actual native operation boundary.
The native operation must acquire the intended disk in the admitted mode; a
path-only preflight followed by a racy attach is not that proof. Busy or changed
identity refuses without retrying, stopping another actor or selecting a
different VHD.

Use the existing renderer and host record after these contracts are implemented;
do not add a controller or clock. Render only parameter data and fixed trusted
operation syntax. Missing exact binding renders a refusal, never the old glob.
A qualified implementation must validate paths as data, bound native output and
duration, and preserve executable supplier identity. No trim, sparse conversion,
resize, deletion, reserve relaxation or attachment of another disk is included.

Retain the started decision before effect in an exclusively created result under
the existing Windows host owner's durable custody, outside the target VHD.
Carry target/owner/admin identities, parameter and script digests, checkpoint
witnesses, native operation identity, timestamps, before/after file and volume
observations, exact native exit/output and terminal or unknown outcome. A shared
`%TEMP%\\compact-wsl.txt` is neither exclusive operation custody nor a receiving
Resource. Retire only that attempt's disposable carrier after its effects are
received. A timeout cannot justify a second compaction or automatic restart.

The Windows result is evidence, not an assertion that storage has reopened.
Physical free-space delta and VHD length delta are distinct observations; no
reclamation amount is promised. Native exit status or English output alone
does not establish completion. An administrator's quota is not the original
fabrication caller's quota.

### Reopening and qualification

After the Windows custodian receives the original operation and admits reentry,
retain the boot holds, reestablish the existing owner's principal/UNC/registry/
VHDX/volume join through the ordinary prescribed WSL plan, and read actual
quota-aware physical capacity. Existing fabrication byte/inode, growth and
reserve gates still decide whether the exact next stage fits. Reopen the old
work only through its own receiver, and receive retained data plus useful
services; merely booting successfully does not release a hold.

Implementation receiving must demonstrate one selected disk, refusal before
effects for missing admission/admin/hive, live or changed target and competing
maintenance, finite timeout with preserved unknown outcome, original result
survival while WSL is stopped, and fresh owner-context capacity after reentry.
Qualify these through an admitted disposable native disk and competent Windows
operator before applying them to an occupied production VHD. Source rendering
tests cannot establish those native conditions.

Microsoft documents that [compact vdisk](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/compact-vdisk)
requires a dynamic disk that is detached or read-only, and distinguishes
[one-distribution termination from whole-VM shutdown](https://learn.microsoft.com/en-us/windows/wsl/basic-commands#shutdown).
Those APIs establish operation scope, not this enterprise's maintenance
authority or a guaranteed reclamation result.

## Durable user-unit quarantine

The optional `linux.userUnitQuarantine` in the same operations parameter record
owns one explicitly named old user unit. The explicit `quarantine-plan`,
`quarantine-hold` and `quarantine-release` entrances run as that exact UID;
ordinary `apply` neither fabricates nor clears this separate custody. A missing
declaration is a refusal, never a release.

Its private marker is under the declared user's private
`.local/state/wsl-host-service/quarantines` area. The group-writable shared
`.local/state/561-group` parent is deliberately not used or modified.
A persistent user-unit drop-in adds `ConditionPathExists=!<marker>`. This is
outside LAGOON's per-profile recovery-hold area: an independently qualified new
controller must be installable while the selector remains blocked. Existing
LAGOON holds still refuse release. No second controller, timer or enablement
identity is introduced. Wants, Restart and later source unit definitions still
pass through the persistent native condition after reboot.

The first hold compares the record's boot ID, MainPID, invocation, cgroup, process
start tick, complete argv and real cwd against the actual frozen resident twice
around the sole native effect, user-manager daemon-reload. Main/control jobs must
be absent. It writes and fsyncs the private marker before the drop-in; a failure
cannot remove either. Receiving must prove the exact loaded drop-in and unchanged
frozen invocation. A partial marker without a loaded condition is held custody,
not a successful boot-safe result. Neither CLI nor ordinary apply stops or thaws
the original process. Omitted and renamed declarations leave existing bytes in
place, so no omission can clear a previous guard.

Release is a separate, explicit owner decision. A later reviewed parameter change
selects the private replacement-receiving Resource by its exact SHA256, with
independent receiver and original subject. Its format is
`WslQuarantineReplacementReceiving@1`: original marker digest and invocation,
unit, selected profile/link/artifact root, native current-record digest, exact
ExecStart, and an explicit independent reconciliation of original unknown effects.
The source-owned expected digest is the authority boundary; a self-authored
checkbox or file does not confer receiving authority. No release Resource is
selected in the incident's initial record.

Before clearing only its own marker, the service checks that Resource against
actual profile link/current record, selected CDE package version/publisher Git
head and selector Git blob; checks the held native unit's exact replacement
command, no main/control process or job; and receives the captured hierarchical
cgroup terminal plus no native LAGOON recovery holds. Reboot or missing PID alone
cannot satisfy the independent reconciliation decision. It fsyncs a release
outcome containing original marker and receiving digests before unlinking its
marker. A partial release refuses further effects for owner reconciliation.
The benign condition remains, and release itself never starts the unit.

Qualification separates pure source/refusal cases from one admitted isolated
native user-unit fixture: freeze an owned harmless unit, install the source-owned
condition without changing its PID/invocation/freezer, prove restart refusal while
held after terminalization and source-definition replacement, then qualify explicit
received release. Fixture effects never touch the production selector. Production
hold application requires independent source/native receiving first; offline
maintenance still requires its separate checkpoint/admin admission.

## Residual work

- A scheduled `plan` that raises drift as work on the board (operations: Bare Cedar Fog).
- Reading the live Defender list needs elevation; the record keeps the 2026-10-05 result file as the last reading.
