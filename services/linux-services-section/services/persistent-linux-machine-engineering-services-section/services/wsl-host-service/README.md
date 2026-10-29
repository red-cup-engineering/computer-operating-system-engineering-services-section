# WSL host service

Generic WSL2 host engineering. From one parameter record it renders and idempotently installs a WSL2 host's Windows-side files (`.wslconfig`, Defender exclusions, pagefile, disk compaction) and Linux-side files (`/etc/wsl.conf`, sysctl, block-queue limits, agent cgroup ceilings, orphan-relay reaper and their units). It uses Node built-ins only and does not depend on MetroPlat.

```sh
node scripts/wsl-host.mjs plan  --parameters=<wsl-host.json>
sudo node scripts/wsl-host.mjs apply --scope=linux   --parameters=<wsl-host.json>
node scripts/wsl-host.mjs apply --scope=windows --parameters=<wsl-host.json>
```

It never restarts WSL and never runs PowerShell; when a change needs either, it prints the one Windows command.

The parameters of Bare Cedar Fog live in `561-group-services-section/services/561-group-operations-services-section/services/bare-cedar-fog-services-section/data/records/wsl-host-service-records/bare-cedar-fog/wsl-host.json`.

Requirements: `specifications/requirements.md`. Design: `specifications/design.md`.
