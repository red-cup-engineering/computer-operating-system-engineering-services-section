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
- **No MetroPlat operation wrapper yet.** MetroPlat may later offer `plan` as a monitored check. The service must not need it.

## Parameter record

`wsl-host-parameters@1`: `windows` (`profileMount`, `profileWindowsPath`, `wslConfig.sections`, `defender`, `pagefile`), `linux` (`wslConf.sections`, `sysctl[]`, `blockQueue`, `agentLimits`, `relayReaper`), and free provenance fields (`observed-*`, `legacy`) that the renderers ignore.

## Residual work

- A scheduled `plan` that raises drift as work on the board (operations: Bare Cedar Fog).
- Reading the live Defender list needs elevation; the record keeps the 2026-10-05 result file as the last reading.
