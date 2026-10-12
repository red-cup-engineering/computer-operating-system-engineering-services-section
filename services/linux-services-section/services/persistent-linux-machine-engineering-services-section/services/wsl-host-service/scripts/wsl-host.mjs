#!/usr/bin/env node
// wsl-host plan|apply --parameters=<wsl-host.json> [--scope=linux|windows|all] [--root=<staging dir>]
// plan: read-only; prints each file and live check; exit 0 converged, 2 drift.
// apply: writes drifted files and runs the hooks they name. Idempotent. Never restarts WSL, never
//        runs PowerShell: it prints the one Windows command the host's owner runs.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyPlan, observeLive, planFiles, renderFiles, windowsInstruction } from "../src/wsl-host.mjs";

const [command = "plan", ...rest] = process.argv.slice(2);
const opt = (name, fallback) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const parametersPath = opt("parameters");
if (!parametersPath || !["plan", "apply"].includes(command)) {
  console.error("usage: wsl-host plan|apply --parameters=<file> [--scope=linux|windows|all] [--root=<dir>]");
  process.exit(64);
}
const params = JSON.parse(readFileSync(parametersPath, "utf8"));
const scope = opt("scope", "all");
const root = opt("root", "");
const inScope = (f) => scope === "all" || f.scope === scope;
const plan = planFiles(renderFiles(params, root)).filter(inScope);

for (const f of plan) console.log(`${f.state.padEnd(7)} ${f.path}`);
let live = [];
if (!root) {
  live = observeLive(params);
  for (const c of live.filter((c) => !c.ok)) console.log(`live    ${c.name}: want ${c.want}, have ${c.have ?? "unreadable"}`);
}
const drift = plan.some((f) => f.state !== "current");

if (command === "apply" && drift) {
  const needsRoot = plan.some((f) => f.state !== "current" && f.scope === "linux");
  if (needsRoot && !root && process.getuid() !== 0) {
    console.error(`Linux files need root: sudo node ${process.argv[1]} apply --scope=linux --parameters=${parametersPath}`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const out = applyPlan(plan, { stamp, staged: Boolean(root), run: (cmd) => execFileSync(cmd[0], cmd.slice(1), { stdio: "inherit" }) });
  console.log(`wrote ${out.written.length} file(s); ran ${out.ran.length} command(s)`);
}
const steps = windowsInstruction(plan, params);
if (steps) for (const s of steps) console.log(`WINDOWS ${s}`);
process.exit(command === "plan" && (drift || live.some((c) => !c.ok)) ? 2 : 0);
