# WSL host service: requirements

Leader statements taken as theory:

- 2026-10-08: "Leave the WSL shit but as ONE thing clean up all our wsl shit to be real proper engineering a real proper package a real fucking thing."
- 2026-10-08: "we cannot rely on metroplat being up for the WSL shit to stick."
- 2026-10-09: the WSL virtual disk lags and crashes; Windows Defender exclusions were already present.

Each requirement has one shall. Identifiers are stable.

## Parameters and rendering

- WSL-1. The service shall render every WSL2 host file, Windows-side and Linux-side, from one parameter record that declares the schema `wsl-host-parameters@1`.
- WSL-2. The service shall carry no host name, user name, path, size or brand in its code; every particular shall come from the parameter record.
- WSL-3. When a parameter carries a comment, the service shall write that comment into the file it renders, so the evidence for a setting travels with the setting.
- WSL-4. The service shall cover `.wslconfig`, `/etc/wsl.conf`, sysctl files, block-queue limits, the agent cgroup ceilings, the orphan-relay reaper, Windows Defender exclusions, the pagefile and WSL disk compaction.

## Independence

- WSL-5. The service shall run on Node's built-in modules alone, so that it installs the host when MetroPlat, the package registry and the network are all unavailable.
- WSL-6. The service shall hold its Linux helper scripts as assets inside the service, not fetch them.

## Observation and repair

- WSL-7. When asked to plan, the service shall change nothing and report each file as current, drift or absent.
- WSL-8. When asked to plan on a live host, the service shall also compare the live kernel values (sysctl, block-queue attributes, kernel command line tokens) with the parameters and report each mismatch.
- WSL-9. When asked to apply, the service shall write only files that are not current, so a second apply writes nothing.
- WSL-10. When it replaces an existing Windows-side file, the service shall first keep the previous content beside it under a dated name.
- WSL-11. When files or managed live values drift, the service shall run each corresponding Linux reload hook once, and leave a converged host unchanged.
- WSL-12. When a boot-time write of a block-queue attribute is refused as busy, the service shall re-send a change event after boot so the limit holds on every disk.

- WSL-17. Apply shall reconcile managed live sysctl, block-queue and memory-budget values even when rendered files are current, using the existing owned hooks.
- WSL-18. Apply shall receive its result by observing the scoped files and live values again, exiting 0 for convergence and 2 for remaining drift.

## Boundaries

- WSL-13. The service shall not restart WSL, shut down the VM or execute Windows configuration actions; its explicit capacity command may execute only the owned bounded read-only Windows probe.
- WSL-14. When a change needs a Windows action, the service shall print the one command the host's owner runs from Windows.
- WSL-15. If an apply needs root and the caller is not root, the service shall stop before writing and print the sudo command.

## Order

- WSL-16. The owner of the particular values shall be the operations section of the host, and the service shall remain generic engineering, in the order science, engineering, operations.
- WSL-19. When the record declares a system-managed pagefile, the service shall render a script that returns the pagefile to Windows' automatic management, because a host running a WSL VM beside desktop applications commits more than its physical memory (Bare Cedar Fog, 2026-10-14: 35–40 GB committed on 23.3 GB of RAM), and a host without a pagefile then fails allocations.
- WSL-20. When the record sets a page-cache ceiling on the headroom guard, the guard shall drop clean page cache whenever the cache exceeds the ceiling, at most once per its minimum interval. A busy VM never goes idle for WSL's `autoMemoryReclaim`, and its cache otherwise holds Windows memory. Bare Cedar Fog, 2026-10-14, under CI: 6.2 GiB of cache held the VM at 9.95 GB with Windows at 98% commit, and one drop returned 4.4 GB to Windows within 20 s.

## Memory that stays resident

Bare Cedar Fog, 2026-10-18 (operations record `observed-2026-10-18`): the agent cgroup sat at its 3 GiB `memory.high` with 2.05 GB of anonymous memory and its whole 256 MiB swap allowance used, so reclaim could take only file pages. Those were the agents' own executables (Claude Code's 268 MB binary, VS Code's `node`, the Copilot runtime) and the Codex app-server's SQLite pages: 12.4 GiB of refaults a minute at the cgroup's read cap, about 330 throttle events a second, and trivial commands stalled for minutes. The VM had 3.7 GB free. The kernel has no MGLRU, so nothing protects a working set that its budget cannot hold.

- WSL-21. When the record declares an in-memory compressed swap device, the service shall create it at boot at a priority above every disk swap, and count its pool limit in the memory budget. Idle anonymous memory then shrinks in RAM instead of evicting the executables beside it, and swap stops depending on the disk path through `hv_storvsc` that crashed the VM on 2026-10-05.
- WSL-22. When the record names reclaim cgroups for the headroom guard, the guard shall take page cache above its ceiling from those cgroups in order, through `memory.reclaim`, and drop clean cache VM-wide only if the cache is still above the ceiling. On 2026-10-18, 1.9 GB of the 2.3–2.9 GB of cache belonged to batch commands in a user slice, and a VM-wide drop evicts the interactive programs' hot pages with it.
- WSL-23. The agent-limits helper shall apply the swap I/O ceiling only to a disk-backed swap device.

## Receiving conditions

- WSL-24. The capacity command shall join the current WSL distribution and Linux destination devices to the exact registry-declared VHDX and Windows backing volume identified in the host record.
- WSL-25. The capacity command shall report real backing-volume available bytes, allocation units, VHDX metadata and the operations-owned reserve, growth and overhead estimates separately from guest filesystem capacity.
- WSL-26. Missing, ambiguous, changed, stale, timed-out or unreadable backing identity or capacity shall refuse without invoking any configuration, cleanup, trim, compaction or service operation.
- WSL-27. The existing live plan command shall report low or unknown physical backing capacity as drift when the host record declares it, preserving staged and undeclared legacy plans.
- WSL-43. The operations-owned backing-capacity policy shall preserve an existing host-owner absolute physical-volume floor rather than replace it with a smaller percentage-only reserve.
- WSL-44. Physical admission shall retain the greater of that absolute floor and the declared physical-volume share, in addition to the operation's peaks and the existing growth and overhead allowances.

The 2026-10-19 incident exhausted Windows C: while guest ext4 reported hundreds
of GiB available. Guest free space is virtual capacity, not permission to expand
its backing VHDX. A declared overhead allowance is an estimate, not an allocation
reservation or a mathematical bound on arbitrary writes. Existing Windows-side
maintenance remains a separately authorized owner action under WSL-14.

## Scoped offline maintenance

- WSL-28. A compaction carrier shall select exactly the existing record's registered distribution, VHDX and backing volume without enumerating alternative disks.
- WSL-29. A compaction carrier shall require the host owner's received maintenance admission referencing the affected original work and its checkpoints before any effect.
- WSL-30. The selected DiskPart or attach-based compaction adapter shall refuse unless its required Windows administrator/privilege and the distribution owner's registry-hive identity are independently established; a different adapter requires qualification against its own documented privilege contract.
- WSL-31. A compaction carrier shall require the selected disk already detached or read-only without stopping, starting or shutting down any distribution itself.
- WSL-32. A compaction carrier shall revalidate the registered target, native file identity and backing volume immediately before its one scoped operation and after its outcome.
- WSL-33. A compaction carrier shall retain its original admission, exact invocation, bounded native outcome and before/after observations in Windows-owned custody outside the target VHDX.
- WSL-34. A compaction carrier shall use an explicitly admitted finite operation and evidence allocation without changing the fabrication reserve policy.
- WSL-35. A timed-out, interrupted or ambiguous maintenance outcome shall remain unknown until its original disk and native operation are reconciled.
- WSL-36. Reopening fabrication shall require a fresh ordinary owner-context capacity join and the original byte/inode and physical-backing admission.
- WSL-37. Maintenance admission shall require durable boot and reentry holds for affected frozen or otherwise held work before the distribution can stop.

- WSL-38. The existing host record shall bind a user-unit quarantine to the actual owner, original work, frozen boot/invocation/process identity and persistent user-manager condition.
- WSL-39. Holding a quarantined unit shall preserve its resident process and freezer state and shall not stop, start, restart, thaw, mask, replay or rewrite its cursor.
- WSL-40. A quarantine shall remain authoritative across reboot, unit replacement and declaration omission; ordinary file reconciliation shall never clear its marker.
- WSL-41. Release shall require a source-owned digest of an independently received replacement Resource binding the original hold, unknown-effect reconciliation, exact installed product/controller and native terminal cohort.
- WSL-42. A partial hold or release shall preserve its original outcome and refuse automatic retry or restart until reconciled.

These requirements do not authorize compaction, elevation, a shutdown, a new
principal, a scheduler or an automatic cleanup hook. The existing all-distro
rendering does not meet them and is not an admitted incident response.

1. `plan` against the host's record exits 0 on a converged host and 2 on drift, naming the files.
2. `apply` run twice writes nothing the second time.
3. Removing MetroPlat from the host changes neither result.
4. The live checks of WSL-8 pass on every disk after a fresh WSL boot, without a manual command.
5. With a declared compressed swap device, `plan` reports it active at its priority after a fresh WSL boot, and `/proc/swaps` lists it above the disk swap.
