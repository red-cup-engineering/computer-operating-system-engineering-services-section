#!/usr/bin/env node
// wsl-host plan|apply --parameters=<file> [--scope=linux|windows|all] [--root=<staging>]
// Plan observes; apply reconciles scoped files and managed live values, then receives convergence.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyPlan, liveReloadHooks, observeLive, planFiles, renderFiles, windowsInstruction } from "../src/wsl-host.mjs";

const [command = "plan", ...rest] = process.argv.slice(2);
const opt = (name, fallback) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const parametersPath = opt("parameters");
const scope = opt("scope", "all");
const root = opt("root", "");
if (!parametersPath || !["plan", "apply"].includes(command) || !["linux", "windows", "all"].includes(scope)) {
  console.error("usage: wsl-host plan|apply --parameters=<file> [--scope=linux|windows|all] [--root=<dir>]");
  process.exit(64);
}
const params = JSON.parse(readFileSync(parametersPath, "utf8"));
const inScope = (f) => scope === "all" || f.scope === scope;
const files = renderFiles(params, root).filter(inScope);
const observe = () => root ? [] : observeLive(params).filter(inScope);
let plan = planFiles(files), live = observe();
const reportLive = (checks) => {
  for (const c of checks.filter((c) => !c.ok)) console.log(`live    ${c.name}: want ${c.want}, have ${c.have ?? "unreadable"}`);
};
for (const f of plan) console.log(`${f.state.padEnd(7)} ${f.path}`);
reportLive(live);
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
process.exit(plan.some((f) => f.state !== "current") || live.some((c) => !c.ok) ? 2 : 0);
