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

## Residual work

- A scheduled `plan` that raises drift as work on the board (operations: Bare Cedar Fog).
- Reading the live Defender list needs elevation; the record keeps the 2026-10-05 result file as the last reading.
