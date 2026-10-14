import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPlan, bytes, memoryBudget, observeLive, planFiles, renderFiles, renderIni, renderPagefileScript, renderSysctl, renderUdev } from "../src/wsl-host.mjs";

test("a system-managed pagefile hands sizing back to Windows and removes no setting by hand (WSL-17)", () => {
  const s = renderPagefileScript({ mode: "system" });
  assert.match(s, /AutomaticManagedPagefile = \$true/);
  assert.doesNotMatch(s, /Remove-CimInstance|New-CimInstance/);
  assert.match(renderPagefileScript({ mode: "fixed", path: "C:\\pagefile.sys", megabytes: 4096 }), /InitialSize = 4096; MaximumSize = 4096/);
});

const params = {
  schema: "wsl-host-parameters@1",
  windows: {
    profileMount: "/win", profileWindowsPath: "C:\\u",
    wslConfig: { sections: [{ name: "wsl2", entries: [{ key: "memory", value: "6GB" }, { key: "kernelCommandLine", value: "swiotlb=131072" }] }] },
    defender: { paths: ["C:\\a"], processes: ["vmmem"], resultFile: "C:\\r.txt" },
    pagefile: { mode: "none" },
  },
  linux: {
    wslConf: { sections: [{ name: "boot", entries: [{ key: "systemd", value: "true" }] }] },
    sysctl: [{ file: "93.conf", entries: [{ key: "vm.swappiness", value: 10 }] }],
    blockQueue: { file: "60.rules", kernel: "sd[a-z]", attributes: { nr_requests: 256 } },
    agentLimits: { description: "d", defaults: { entries: [{ key: "PIDS_MAX", value: "4096" }] } },
    relayReaper: { description: "r", minAgeSeconds: 600, minFreeRings: 64, bootDelayMinutes: 15, intervalMinutes: 5 },
  },
};

test("renderers", () => {
  assert.equal(renderIni([{ name: "a", entries: [{ comment: ["why"], key: "k", value: 1 }] }]), "[a]\n# why\nk=1\n");
  assert.equal(renderSysctl({ entries: [{ key: "a.b", value: 1 }] }), "a.b = 1\n");
  assert.match(renderUdev(params.linux.blockQueue), /KERNEL=="sd\[a-z\]", ATTR\{queue\/nr_requests\}="256"/);
});

test("apply is idempotent and keeps a backup of a replaced Windows file", () => {
  const root = mkdtempSync(join(tmpdir(), "wsl-host-"));
  const files = renderFiles(params, root);
  const first = applyPlan(planFiles(files), { stamp: "t", staged: true });
  assert.equal(first.written.length, files.length);
  const second = applyPlan(planFiles(files), { stamp: "t", staged: true });
  assert.deepEqual(second.written, []);
  const cfg = files.find((f) => f.path.endsWith(".wslconfig"));
  const changed = renderFiles({ ...params, windows: { ...params.windows, wslConfig: { sections: [{ name: "wsl2", entries: [{ key: "memory", value: "8GB" }] }] } } }, root);
  applyPlan(planFiles(changed), { stamp: "t", staged: true });
  assert.match(readFileSync(`${cfg.path}.t-before-wsl-host-service`, "utf8"), /memory=6GB/);
});

test("the headroom guard renders only when the record declares it, with its floor, interval and cache step", () => {
  const without = renderFiles(params).map((f) => f.path);
  assert.ok(!without.some((p) => p.includes("headroom-guard")));
  const guarded = { ...params, linux: { ...params.linux, headroomGuard: { description: "g", minOrder7Blocks: 32, intervalSeconds: 5, dropCachesWhenShort: true } } };
  const files = renderFiles(guarded);
  const unit = files.find((f) => f.path === "/etc/systemd/system/wsl-hvsock-headroom-guard.service");
  assert.match(unit.content, /ExecStart=\/usr\/local\/sbin\/wsl-hvsock-headroom-guard 32 5 yes/);
  assert.match(unit.content, /Restart=always/);
  const script = files.find((f) => f.path === "/usr/local/sbin/wsl-hvsock-headroom-guard");
  assert.equal(script.mode, 0o755);
  assert.ok(script.hooks.includes("headroom-guard"));
});

const budgeted = (agentHigh, units) => ({
  ...params,
  linux: {
    ...params.linux,
    agentLimits: { description: "d", defaults: { entries: [{ key: "MEMORY_HIGH", value: agentHigh }, { key: "MEMORY_MAX", value: "4608M" }] } },
    memoryBudget: { kernelHeadroom: "2G", units },
  },
});
const units = [
  { unit: "user.slice", cgroup: "user.slice", high: "1G", max: "2G" },
  { unit: "guix-daemon.service", cgroup: "system.slice/guix-daemon.service", high: "512M", max: "2G" },
];

test("sizes read as systemd and .wslconfig write them", () => {
  assert.equal(bytes("4608M"), 4608 * 2 ** 20);
  assert.equal(bytes("4G"), 4 * 2 ** 30);
  assert.equal(bytes("6GB"), 6 * 2 ** 30);
  assert.throws(() => bytes("lots"), /unreadable size/);
});

test("the memory budget bounds every systemd unit it names and leaves the kernel its headroom", () => {
  const ok = budgeted("2560M", units);
  assert.equal(memoryBudget(ok).highs, 2560 * 2 ** 20 + 2 ** 30 + 512 * 2 ** 20);
  const dropIns = renderFiles(ok).filter((f) => f.path.endsWith("90-wsl-host-memory.conf"));
  assert.deepEqual(dropIns.map((f) => f.path), ["/etc/systemd/system/user.slice.d/90-wsl-host-memory.conf", "/etc/systemd/system/guix-daemon.service.d/90-wsl-host-memory.conf"]);
  assert.match(dropIns[0].content, /\[Slice\]\nMemoryHigh=1G\nMemoryMax=2G/);
  assert.match(dropIns[1].content, /\[Service\]\nMemoryHigh=512M\nMemoryMax=2G/);
  assert.ok(dropIns.every((f) => f.hooks.includes("memory-budget")));
  // 6GB VM less 2G headroom leaves 4G of high-water marks; 3G of agents plus 1.5G overruns it.
  assert.throws(() => renderFiles(budgeted("3G", units)), /memory budget: high-water marks sum/);
  assert.equal(renderFiles(params).filter((f) => f.path.endsWith("90-wsl-host-memory.conf")).length, 0);
});

test("the live check reads each budgeted cgroup's high and max", () => {
  const live = { "/sys/fs/cgroup/non-systemd/memory.high": String(2560 * 2 ** 20), "/sys/fs/cgroup/user.slice/memory.high": "max" };
  const checks = observeLive(budgeted("2560M", units), { read: (p) => live[p] ?? null, list: () => [] });
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  assert.equal(byName["non-systemd agents memory.high"].ok, true);
  assert.equal(byName["user.slice memory.high"].ok, false);
  assert.equal(byName["guix-daemon.service memory.max"].want, String(2 * 2 ** 30));
});
