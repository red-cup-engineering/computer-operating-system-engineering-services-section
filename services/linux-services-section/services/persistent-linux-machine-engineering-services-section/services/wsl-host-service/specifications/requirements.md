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

- WSL-13. The service shall not restart WSL, shut down the VM or run PowerShell.
- WSL-14. When a change needs a Windows action, the service shall print the one command the host's owner runs from Windows.
- WSL-15. If an apply needs root and the caller is not root, the service shall stop before writing and print the sudo command.

## Order

- WSL-16. The owner of the particular values shall be the operations section of the host, and the service shall remain generic engineering, in the order science, engineering, operations.
- WSL-19. When the record declares a system-managed pagefile, the service shall render a script that returns the pagefile to Windows' automatic management, because a host running a WSL VM beside desktop applications commits more than its physical memory (Bare Cedar Fog, 2026-10-14: 35–40 GB committed on 23.3 GB of RAM), and a host without a pagefile then fails allocations.
- WSL-20. When the record sets a page-cache ceiling on the headroom guard, the guard shall drop clean page cache whenever the cache exceeds the ceiling, at most once per its minimum interval. A busy VM never goes idle for WSL's `autoMemoryReclaim`, and its cache otherwise holds Windows memory. Bare Cedar Fog, 2026-10-14, under CI: 6.2 GiB of cache held the VM at 9.95 GB with Windows at 98% commit, and one drop returned 4.4 GB to Windows within 20 s.

## Receiving conditions

1. `plan` against the host's record exits 0 on a converged host and 2 on drift, naming the files.
2. `apply` run twice writes nothing the second time.
3. Removing MetroPlat from the host changes neither result.
4. The live checks of WSL-8 pass on every disk after a fresh WSL boot, without a manual command.
