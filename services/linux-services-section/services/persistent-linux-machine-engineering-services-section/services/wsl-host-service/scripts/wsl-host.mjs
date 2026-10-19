#!/usr/bin/env node
// wsl-host plan|apply --parameters=<file> [--scope=linux|windows|all] [--root=<staging>]
// Plan observes; apply reconciles scoped files and managed live values, then receives convergence.
import { holdQuarantine, planQuarantine, releaseQuarantine } from '../src/user-unit-quarantine.mjs';
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyPlan, liveReloadHooks, observeLive, planFiles, renderFiles, windowsInstruction, observeBackingVolumeCapacity, assessBackingVolumeHeadroom } from "../src/wsl-host.mjs";

const [command = "plan", ...rest] = process.argv.slice(2);
const opt = (name, fallback) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const parametersPath = opt("parameters");
const scope = opt("scope", "all");
const root = opt("root", "");
if (!parametersPath || !["plan", "apply", "capacity", "quarantine-plan", "quarantine-hold", "quarantine-release"].includes(command) || !["linux", "windows", "all"].includes(scope)) {
  console.error("usage: wsl-host plan|apply|capacity|quarantine-plan|quarantine-hold|quarantine-release --parameters=<file> [--scope=linux|windows|all] [--root=<dir>] [--destinations-json=<array>]");
  process.exit(64);
}
const params = JSON.parse(readFileSync(parametersPath, "utf8"));
if (command.startsWith('quarantine-')) {
  try {
    if (root || scope !== 'all') throw new Error('quarantine requires the actual declared user manager, not staged/scoped file reconciliation');
    const operation = { 'quarantine-plan': planQuarantine, 'quarantine-hold': holdQuarantine, 'quarantine-release': releaseQuarantine }[command];
    const result = operation(params);
    console.log(JSON.stringify(result));
    if (command === 'quarantine-plan' && result.status === 'unheld') process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
} else if (command === 'capacity') {
  try {
    const raw = opt('destinations-json', '["/"]');
    if (Buffer.byteLength(raw) > 16384) throw new TypeError('destination input exceeds 16 KiB');
    const result = observeBackingVolumeCapacity(params, JSON.parse(raw));
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`wsl-host capacity refused: ${error.message}`); process.exitCode = 2; }
} else {
const inScope = (f) => scope === "all" || f.scope === scope;
const files = renderFiles(params, root).filter(inScope);
const observe = () => root ? [] : observeLive(params).filter(inScope);
let plan = planFiles(files), live = observe();
let backing = [];
let quarantine = [];
if (command === 'plan' && !root && scope !== 'windows' && params.linux?.userUnitQuarantine) {
  try {
    const result = planQuarantine(params);
    quarantine = [{ name: 'durable user-unit quarantine', ok: result.status === 'held', want: 'received loaded persistent hold', have: result.status }];
  } catch (error) {
    quarantine = [{ name: 'durable user-unit quarantine', ok: false, want: 'received loaded persistent hold', have: error.message }];
  }
}
if (command === 'plan' && !root && scope !== 'linux' && params.windows?.backingStorage) {
  try {
    backing = assessBackingVolumeHeadroom(observeBackingVolumeCapacity(params, ['/'])).map(v => ({
      name: `Windows backing capacity ${v.id}`, ok: v.admitted,
      want: `at least ${v.requiredBytes} bytes (physical reserve + growth + estimated overhead)`, have: `${v.availableBytes} available bytes`
    }));
    for (const c of backing.filter(c => c.ok)) console.log(`current ${c.name}: ${c.have}; ${c.want}`);
  } catch (error) { backing = [{ name: 'Windows backing capacity', ok: false, want: 'fresh registered physical capacity', have: `unknown: ${error.message}` }]; }
}
const reportLive = (checks) => {
  for (const c of checks.filter((c) => !c.ok)) console.log(`live    ${c.name}: want ${c.want}, have ${c.have ?? "unreadable"}`);
};
for (const f of plan) console.log(`${f.state.padEnd(7)} ${f.path}`);
reportLive([...live, ...backing, ...quarantine]);
const drift = plan.some((f) => f.state !== "current");
const hooks = liveReloadHooks(live);
if (command === "apply" && (drift || hooks.length)) {
  const needsRoot = hooks.length > 0 || plan.some((f) => f.state !== "current" && f.scope === "linux");
  if (needsRoot && !root && process.getuid() !== 0) {
    console.error(`Linux reconciliation needs root: sudo node ${process.argv[1]} apply --scope=linux --parameters=${parametersPath}`);
    process.exit(1);
  }
  const out = applyPlan(plan, {
    stamp: new Date().toISOString().slice(0, 10), staged: Boolean(root), live,
    run: (cmd) => execFileSync(cmd[0], cmd.slice(1), { stdio: "inherit" }),
  });
  console.log(`wrote ${out.written.length} file(s); ran ${out.ran.length} command(s)`);
}
const steps = windowsInstruction(plan, params);
if (steps) for (const s of steps) console.log(`WINDOWS ${s}`);
if (command === "apply") {
  plan = planFiles(files);
  live = observe();
  reportLive(live);
}
process.exit(plan.some((f) => f.state !== "current") || live.some((c) => !c.ok) || (backing.some((c) => !c.ok) || quarantine.some((c) => !c.ok)) ? 2 : 0);
}
