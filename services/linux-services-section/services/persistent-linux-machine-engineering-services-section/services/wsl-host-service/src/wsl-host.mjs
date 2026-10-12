// WSL2 host engineering: render a host's configuration from one parameter record, observe the
// host, and report or repair the difference. Pure functions plus a thin filesystem edge.
// Node built-ins only: this must run when nothing else (no MetroPlat, no package install,
// no network) is up. Parameters are data and carry every particular; nothing here names a host.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PARAMETER_SCHEMA = "wsl-host-parameters@1";
const assetDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const commentLines = (c) => (c ?? []).map((l) => (l === "" ? "#" : `# ${l}`));

/** Renders [{name, entries:[{key,value,comment?}]}] as an ini file (wsl.conf, .wslconfig). */
export function renderIni(sections) {
  const out = [];
  sections.forEach((section, i) => {
    if (i) out.push("");
    out.push(`[${section.name}]`);
    for (const e of section.entries) out.push(...commentLines(e.comment), `${e.key}=${e.value}`);
  });
  return out.join("\n") + "\n";
}

/** Renders a sysctl.d file; `compact` writes key=value, otherwise key = value. */
export function renderSysctl(file) {
  const eq = file.compact ? "=" : " = ";
  return [...commentLines(file.comment), ...file.entries.map((e) => `${e.key}${eq}${e.value}`)].join("\n") + "\n";
}

/** Renders one udev rule that sets block-queue attributes on matching disks. */
export function renderUdev(block) {
  const attrs = Object.entries(block.attributes).map(([k, v]) => `ATTR{queue/${k}}="${v}"`);
  const rule = [`ACTION=="add|change"`, `SUBSYSTEM=="block"`, `KERNEL=="${block.kernel}"`, ...attrs].join(", ");
  return [...commentLines(block.comment), rule].join("\n") + "\n";
}

/** Renders the shell-sourced defaults file read by the agent-limits script. */
export function renderEnv(env) {
  const out = [];
  for (const e of env.entries) out.push(...commentLines(e.comment), `${e.key}=${e.value}`);
  return out.join("\n") + "\n";
}

export function renderReaperUnits(r) {
  return {
    service: `[Unit]\nDescription=${r.description}\n\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/wsl-orphan-relay-reaper ${r.minAgeSeconds} ${r.minFreeRings}\n`,
    timer: `[Unit]\nDescription=${r.description} every ${r.intervalMinutes} minutes\n\n[Timer]\nOnBootSec=${r.bootDelayMinutes}min\nOnUnitInactiveSec=${r.intervalMinutes}min\n\n[Install]\nWantedBy=timers.target\n`,
  };
}

/**
 * The udev rule alone is not enough: at boot the kernel still holds the disks, and udev's write of
 * queue/nr_requests fails with "Device or resource busy" (measured 2026-10-09 on every boot-time disk
 * but the late-attached swap disk). A change event after boot succeeds, so this unit sends one.
 */
export function renderBlockQueueUnit() {
  return [
    "[Unit]",
    "Description=Re-apply block-queue limits after boot, when udev's boot-time write was refused as busy",
    "After=local-fs.target systemd-udevd.service",
    "",
    "[Service]",
    "Type=oneshot",
    "RemainAfterExit=yes",
    "ExecStart=/usr/bin/udevadm trigger --subsystem-match=block --action=change --settle",
    // A disk still busy at the first event (measured: the 700 MB system disk) takes the second.
    "ExecStart=/bin/sleep 20",
    "ExecStart=/usr/bin/udevadm trigger --subsystem-match=block --action=change --settle",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n");
}

/** A resident watcher that compacts when free order-7 blocks fall below the floor (hv_sock rings). */
export function renderHeadroomGuardUnit(g) {
  return [
    "[Unit]",
    `Description=${g.description}`,
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=/usr/local/sbin/wsl-hvsock-headroom-guard ${g.minOrder7Blocks} ${g.intervalSeconds} ${g.dropCachesWhenShort ? "yes" : "no"}`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n");
}

export function renderAgentLimitsUnits(a) {
  return {
    path: `[Unit]\nDescription=Apply agent ceilings as soon as WSL creates its non-systemd cgroup\n\n[Path]\nPathExists=/sys/fs/cgroup/non-systemd\n\n[Install]\nWantedBy=paths.target\n`,
    service: `[Unit]\nDescription=${a.description}\nConditionPathIsDirectory=/sys/fs/cgroup/non-systemd\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/usr/local/sbin/wsl-agent-limits\n`,
  };
}

const SIZE_UNITS = { "": 0, K: 1, M: 2, G: 3 };
/** Bytes of a size as systemd, the agent-limits file and .wslconfig write it (4608M, 4G, 8GB). */
export function bytes(size) {
  const m = /^(\d+(?:\.\d+)?)([KMG]?)B?$/.exec(String(size));
  if (!m) throw new Error(`unreadable size ${size}`);
  return Math.round(Number(m[1]) * 1024 ** SIZE_UNITS[m[2]]);
}

/**
 * The VM's memory budget. hv_sock rings need order-7 (512 KiB) contiguous blocks, which compaction can
 * assemble only while memory is free; so every consumer's high-water mark, summed, must leave the kernel
 * its headroom. The VM size is .wslconfig's `memory`, the non-systemd agents' marks are agentLimits', and
 * each systemd unit in `units` takes a drop-in. Throws when the marks overrun the VM. null without a budget.
 */
export function memoryBudget(params) {
  const b = params.linux.memoryBudget;
  if (!b) return null;
  const vm = bytes(params.windows.wslConfig.sections.flatMap((s) => s.entries).find((e) => e.key === "memory")?.value);
  const agent = Object.fromEntries(params.linux.agentLimits.defaults.entries.map((e) => [e.key, e.value]));
  const groups = [{ name: "non-systemd agents", cgroup: "non-systemd", high: agent.MEMORY_HIGH, max: agent.MEMORY_MAX }, ...b.units.map((u) => ({ name: u.unit, cgroup: u.cgroup, high: u.high, max: u.max }))];
  const highs = groups.reduce((sum, g) => sum + bytes(g.high), 0), limit = vm - bytes(b.kernelHeadroom);
  if (highs > limit) throw new Error(`memory budget: high-water marks sum to ${highs} bytes, above the ${limit} the VM leaves after ${b.kernelHeadroom} of kernel headroom`);
  return { vm, limit, highs, groups };
}

/** A systemd drop-in that bounds one slice or service. */
export function renderMemoryDropIn(u) {
  return [...commentLines(u.comment), `[${u.unit.endsWith(".slice") ? "Slice" : "Service"}]`, `MemoryHigh=${u.high}`, `MemoryMax=${u.max}`, ""].join("\n");
}

const psList = (xs) => xs.map((x) => `'${x}'`).join(",");

export function renderDefenderScript(d) {
  return [
    `Add-MpPreference -ExclusionPath ${psList(d.paths)}`,
    `Add-MpPreference -ExclusionProcess ${psList(d.processes)}`,
    `Get-MpPreference | Select-Object ExclusionPath,ExclusionProcess | Format-List | Out-File '${d.resultFile}'`,
  ].join("\n") + "\n";
}

export function renderPagefileScript(p) {
  const head = `# Run from an elevated PowerShell; takes effect after a Windows restart.\n$cs = Get-CimInstance Win32_ComputerSystem\nSet-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $false }\nGet-CimInstance Win32_PageFileSetting | Remove-CimInstance\n`;
  if (p.mode === "none") return head;
  return head + `New-CimInstance -ClassName Win32_PageFileSetting -Property @{ Name = '${p.path}'; InitialSize = ${p.megabytes}; MaximumSize = ${p.megabytes} }\n`;
}

export function renderCompactScript() {
  return [
    "# Run from an elevated PowerShell. Shuts WSL down, then compacts every distro disk under %LOCALAPPDATA%\\wsl.",
    "wsl.exe --shutdown",
    "Start-Sleep -Seconds 10",
    "Get-ChildItem \"$env:LOCALAPPDATA\\wsl\\*\\ext4.vhdx\" | ForEach-Object {",
    "  $before = $_.Length",
    "  $dp = Join-Path $env:TEMP 'compact-wsl.txt'",
    "  \"select vdisk file=`\"$($_.FullName)`\"`nattach vdisk readonly`ncompact vdisk`ndetach vdisk\" | Set-Content -Encoding ascii $dp",
    "  diskpart /s $dp",
    "  Remove-Item $dp",
    "  \"{0}: {1:N1} GB -> {2:N1} GB\" -f $_.FullName, ($before/1GB), ((Get-Item $_.FullName).Length/1GB)",
    "}",
    "",
  ].join("\n");
}

const asset = (name) => readFileSync(join(assetDir, name), "utf8");

/**
 * Every file the host needs, as {scope, path, content, mode, hooks}. `root` prefixes Linux
 * targets (for staging and tests); Windows targets are under params.windows.profileMount.
 */
export function renderFiles(params, root = "") {
  if (params.schema !== PARAMETER_SCHEMA) throw new Error(`parameters must declare schema ${PARAMETER_SCHEMA}`);
  const files = [];
  const linux = (path, content, mode, hooks = []) => files.push({ scope: "linux", path: root + path, content, mode, hooks });
  const L = params.linux, W = params.windows;

  linux("/etc/wsl.conf", renderIni(L.wslConf.sections), 0o644, ["wsl-restart"]);
  for (const f of L.sysctl) linux(`/etc/sysctl.d/${f.file}`, renderSysctl(f), 0o644, ["sysctl"]);
  linux(`/etc/udev/rules.d/${L.blockQueue.file}`, renderUdev(L.blockQueue), 0o644, ["udev"]);

  linux("/etc/systemd/system/wsl-block-queue.service", renderBlockQueueUnit(), 0o644, ["systemd"]);

  const a = L.agentLimits, lim = renderAgentLimitsUnits(a);
  linux("/etc/default/wsl-agent-limits", renderEnv(a.defaults), 0o644, ["agent-limits"]);
  linux("/usr/local/sbin/wsl-agent-limits", asset("wsl-agent-limits.sh"), 0o755, ["agent-limits"]);
  linux("/etc/systemd/system/wsl-agent-limits.path", lim.path, 0o644, ["systemd"]);
  linux("/etc/systemd/system/wsl-agent-limits.service", lim.service, 0o644, ["systemd", "agent-limits"]);

  if (memoryBudget(params))
    for (const u of L.memoryBudget.units) linux(`/etc/systemd/system/${u.unit}.d/90-wsl-host-memory.conf`, renderMemoryDropIn(u), 0o644, ["memory-budget"]);

  if (L.headroomGuard) {
    linux("/usr/local/sbin/wsl-hvsock-headroom-guard", asset("wsl-hvsock-headroom-guard.sh"), 0o755, ["headroom-guard"]);
    linux("/etc/systemd/system/wsl-hvsock-headroom-guard.service", renderHeadroomGuardUnit(L.headroomGuard), 0o644, ["systemd", "headroom-guard"]);
  }

  const r = L.relayReaper, units = renderReaperUnits(r);
  linux("/usr/local/sbin/wsl-orphan-relay-reaper", asset("wsl-orphan-relay-reaper.sh"), 0o755);
  linux("/etc/systemd/system/wsl-orphan-relay-reaper.service", units.service, 0o644, ["systemd"]);
  linux("/etc/systemd/system/wsl-orphan-relay-reaper.timer", units.timer, 0o644, ["systemd"]);

  const win = (name, content, hooks = []) => files.push({ scope: "windows", path: join(root + W.profileMount, name), content, mode: 0o644, hooks });
  win(".wslconfig", renderIni(W.wslConfig.sections), ["wsl-restart"]);
  win("wsl-defender-exclusions.ps1", renderDefenderScript(W.defender), ["defender"]);
  if (W.pagefile) win("wsl-host-pagefile.ps1", renderPagefileScript(W.pagefile), ["windows-restart"]);
  win("wsl-compact-disk.ps1", renderCompactScript());
  return files;
}

const norm = (s) => s.replace(/\r\n/g, "\n").replace(/[ \t\n]+$/, "");

/** Compares rendered files with what is on disk. State: current | drift | absent. */
export function planFiles(files, read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null)) {
  return files.map((f) => {
    const have = read(f.path);
    return { ...f, state: have === null ? "absent" : norm(have) === norm(f.content) ? "current" : "drift", have };
  });
}

/** Reads live kernel state the files are meant to produce. Each check: {name, want, have, ok}. */
export function observeLive(params, sys = { read: (p) => { try { return readFileSync(p, "utf8").trim(); } catch { return null; } }, list: (p) => { try { return readdirSync(p); } catch { return []; } } }) {
  const checks = [];
  for (const f of params.linux.sysctl) for (const e of f.entries) {
    const have = sys.read(`/proc/sys/${e.key.replaceAll(".", "/")}`);
    checks.push({ name: e.key, want: String(e.value), have, ok: have === String(e.value) });
  }
  const re = new RegExp(`^${params.linux.blockQueue.kernel}$`);
  for (const disk of sys.list("/sys/block").filter((d) => re.test(d)))
    for (const [k, v] of Object.entries(params.linux.blockQueue.attributes)) {
      const have = sys.read(`/sys/block/${disk}/queue/${k}`);
      checks.push({ name: `${disk} queue/${k}`, want: String(v), have, ok: have === String(v) });
    }
  const cmd = sys.read("/proc/cmdline") ?? "";
  const kcl = (params.windows.wslConfig.sections.flatMap((s) => s.entries).find((e) => e.key === "kernelCommandLine")?.value ?? "").split(/\s+/).filter(Boolean);
  for (const tok of kcl) checks.push({ name: `kernel cmdline ${tok}`, want: tok, have: cmd.split(/\s+/).includes(tok) ? tok : null, ok: cmd.split(/\s+/).includes(tok) });
  for (const g of memoryBudget(params)?.groups ?? [])
    for (const [k, v] of [["high", g.high], ["max", g.max]]) {
      const have = sys.read(`/sys/fs/cgroup/${g.cgroup}/memory.${k}`);
      checks.push({ name: `${g.name} memory.${k}`, want: String(bytes(v)), have, ok: have === String(bytes(v)) });
    }
  return checks;
}

/** What the Leader must do from Windows, given the plan. null when nothing is needed. */
export function windowsInstruction(plan, params) {
  const drift = plan.filter((f) => f.state !== "current");
  const has = (h) => drift.some((f) => f.hooks.includes(h));
  const steps = [];
  const profile = params.windows.profileWindowsPath;
  if (has("defender")) steps.push(`In an elevated PowerShell: powershell -ExecutionPolicy Bypass -File ${profile}\\wsl-defender-exclusions.ps1`);
  if (has("windows-restart")) steps.push(`In an elevated PowerShell: powershell -ExecutionPolicy Bypass -File ${profile}\\wsl-host-pagefile.ps1, then restart Windows`);
  if (has("wsl-restart")) steps.push("To make the WSL settings take effect, from Windows: wsl.exe --shutdown");
  return steps.length ? steps : null;
}

const HOOK_COMMANDS = {
  sysctl: [["sysctl", "--system"]],
  udev: [["udevadm", "control", "--reload-rules"], ["udevadm", "trigger", "--subsystem-match=block", "--action=change"]],
  systemd: [["systemctl", "daemon-reload"], ["systemctl", "enable", "--now", "wsl-agent-limits.path", "wsl-block-queue.service", "wsl-orphan-relay-reaper.timer"]],
  "agent-limits": [["systemctl", "restart", "wsl-agent-limits.service"]],
  "memory-budget": [["systemctl", "daemon-reload"]],
  "headroom-guard": [["systemctl", "daemon-reload"], ["systemctl", "enable", "wsl-hvsock-headroom-guard.service"], ["systemctl", "restart", "wsl-hvsock-headroom-guard.service"]],
};

/**
 * Writes every file that is not current, then runs the hooks the changed files name, once each.
 * A replaced Windows file is first copied to <name>.<stamp>-before-wsl-host-service.
 * `run` is injected so tests never execute commands; with a staging root no hooks run.
 */
export function applyPlan(plan, { stamp, run, staged = false }) {
  const changed = plan.filter((f) => f.state !== "current");
  for (const f of changed) {
    mkdirSync(dirname(f.path), { recursive: true });
    if (f.state === "drift" && f.scope === "windows") copyFileSync(f.path, `${f.path}.${stamp}-before-wsl-host-service`);
    writeFileSync(f.path, f.content);
    chmodSync(f.path, f.mode);
  }
  const hooks = [...new Set(changed.flatMap((f) => f.hooks))].filter((h) => HOOK_COMMANDS[h]);
  const ran = [];
  if (!staged) for (const h of hooks) for (const cmd of HOOK_COMMANDS[h]) { run(cmd); ran.push(cmd.join(" ")); }
  return { written: changed.map((f) => f.path), ran };
}
