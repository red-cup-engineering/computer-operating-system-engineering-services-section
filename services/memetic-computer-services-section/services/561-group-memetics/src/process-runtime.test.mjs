import test from "node:test";
import assert from "node:assert/strict";

import { accessibleFrom, orderProcess } from "./allocation.mjs";
import { allocateProcess } from "@red-cup-engineering/computer/process-runtime/allocation";
import { dispatchProcess, executeProcess, deriveProcessState } from "./dispatch.mjs";
import { readStructuration } from "./governance.mjs";
import { createProcess, ProcessRuntime, processRuntime, readProcessValue, settleProcess } from "./process.mjs";
import { advanceProcesses, conserveEvidence, precipitateUnsettled } from "./scheduler.mjs";

test("allocateProcess places a process at a proof-pathing typed log coordinate", () => {
  const allocated = allocateProcess(createProcess("p6"), { root: "/tmp/world", modal: "actual" }, "orchestrator", "leader");

  assert.equal(allocated.allocation.modal, "actual");
  assert.equal(allocated.allocation.term, "processes/actual/p6");
  assert.equal(allocated.allocation.path, "/tmp/world/processes/actual/p6/p6.jsonl");
  assert.equal(allocated.allocation.principal, "orchestrator");
  assert.equal(allocated.allocation.accountable, "leader");

  const defaulted = allocateProcess(createProcess("p6b"), { root: "/tmp/world" }, "coordinator");
  assert.equal(defaulted.allocation.accountable, "coordinator");
});

test("orderProcess and accessibleFrom expose the happens-before accessibility relation", () => {
  const a = createProcess("A");
  const b = orderProcess(createProcess("B"), [a]);

  assert.deepEqual(b.after, ["A"]);
  assert.equal(accessibleFrom(a, b), true);
  assert.equal(accessibleFrom(b, a), false);
  assert.equal(accessibleFrom(createProcess("proc-1"), { id: "proc-2", after: "proc-1" }), true);
  assert.equal(accessibleFrom({ id: "from", successors: "to" }, createProcess("to")), true);
});

test("dispatchProcess and executeProcess append transition rows and derive latest state", () => {
  let proc = createProcess("p7");
  proc = dispatchProcess(proc, "programmer", "orchestrator", { t: "001" });
  proc = executeProcess(proc, "worker-7", "started", { t: "002" });
  proc = executeProcess(proc, "worker-7", "completed", { t: "003" });
  proc = { ...proc, rows: [...proc.rows, { e: "p7", a: "principal", v: "alice", t: "004" }] };

  assert.equal(proc.rows.length, 7);
  const state = deriveProcessState(proc);
  assert.equal(state.dispatchedTo, "programmer");
  assert.equal(state.executionState, "completed");
  assert.equal(state.principal, "alice");
  assert.deepEqual(state.history.map((entry) => entry.state), ["started", "completed"]);
});

test("dispatchProcess and executeProcess require external transition stamps", () => {
  const proc = createProcess("p7-clockless");

  assert.throws(
    () => dispatchProcess(proc, "programmer", "orchestrator", undefined),
    /explicit transition stamp required/,
  );
  assert.throws(
    () => executeProcess(proc, "worker-7", "started", {}),
    /explicit transition stamp required/,
  );

  assert.equal(dispatchProcess(proc, "programmer", "orchestrator", { now: 7 }).dispatch.t, "7");
  assert.equal(executeProcess(proc, "worker-7", "started", { at: { label: "tick-8" } }).execution.t, "tick-8");
});

test("ProcessRuntime seeds a registry, settles registered processes, and exports a shared runtime", () => {
  const runtime = new ProcessRuntime([
    { id: "seeded", rows: [{ e: "seeded", a: "ready", v: true, t: "001" }] },
  ]);

  assert.equal(runtime.get("seeded")?.id, "seeded");
  assert.equal(runtime.settle("seeded").ready, true);
  assert.throws(() => runtime.settle("missing"), /unknown process missing/);

  const spawned = processRuntime.spawn({ id: "shared-runtime-test", rows: [] });
  assert.equal(processRuntime.get(spawned.id), spawned);
});

test("advanceProcesses partitions by MemeCharge readiness and predecessor readiness", () => {
  const readyA = createProcess({ id: "A", rows: [{ e: "A", a: "needs", v: "x", t: "1" }] });
  const waitingB = orderProcess(createProcess({ id: "B", rows: [{ e: "B", a: "needs", v: "y", t: "1" }] }), [readyA]);
  const openC = createProcess("C");

  const out = advanceProcesses({ processList: [readyA, waitingB, openC] });
  assert.deepEqual(out.dispatched.map((s) => s.process.id).sort(), ["A", "B"]);
  assert.deepEqual(out.blocked.map((s) => s.process.id), ["C"]);
  assert.equal(out.counts.settled, 3);

  const unsettledA = createProcess("A");
  const blockedByA = advanceProcesses({ processList: [unsettledA, waitingB] });
  assert.deepEqual(blockedByA.blocked.map((s) => s.process.id).sort(), ["A", "B"]);
});

test("precipitateUnsettled keeps absurd and stable residue out of ready work", () => {
  const ready = settleProcess(null, createProcess({
    id: "ready",
    judge: () => [{ value: "potential", name: "ready", reason: "test", path: "ready" }],
  }));
  const open = settleProcess(null, createProcess({ id: "open", after: ["held"] }));
  const held = settleProcess(null, createProcess({
    id: "held",
    after: ["root"],
    rows: [
      { e: "held", a: "ready", v: "yes", t: "h1" },
      { e: "held", a: "ready", v: "yes", t: "h2", op: "retract" },
    ],
    judge: () => [{ value: "stable", name: "held", reason: "test", path: "held" }],
  }));

  const out = precipitateUnsettled([ready, open, held]);

  assert.deepEqual(out.residue.map((s) => s.process.id).sort(), ["held", "open"]);
  assert.deepEqual(out.unsettled.map((s) => s.process.id), ["open"]);
  assert.deepEqual(out.contradicted.map((s) => s.process.id), ["held"]);
  assert.deepEqual(out.kernelResidue, [["before", "before"]]);
  assert.equal(out.void, out.gap);
  assert.deepEqual(out.void.map((reading) => [reading.id, reading.value]), [["open", "absurd"], ["held", "stable"]]);
  assert.deepEqual(out.void.find((reading) => reading.id === "open")?.settled, []);
  assert.deepEqual(out.void.find((reading) => reading.id === "held")?.settled, [{
    predicate: "ready",
    object: "yes",
    value: "stable",
    witnesses: ["h1", "h2"],
  }]);
});

test("settleProcess saturation returns a residue with cells and witnesses", () => {
  let n = 0;
  const derive = (proc) => {
    n += 1;
    return [{ e: proc.id, a: "step", v: `s${n}`, t: String(1000 + n) }];
  };

  const settled = settleProcess(
    null,
    createProcess({ id: "loop", rows: [{ e: "loop", a: "needs", v: "review", t: "001" }] }),
    { derive, maxFolds: 4 },
  );

  assert.equal(settled.quiesced, false);
  assert.equal(settled.value, "absurd");
  assert.equal(settled.condition, "resource-exhausted");
  assert.equal(settled.fault?.charge, "absurd");
  assert.ok(settled.residue);
  assert.ok(settled.residue.cells.length > 0);
  assert.ok(settled.residue.witnesses.includes("001"));
  assert.equal(settled.residue.cone.kind, "process.readiness-cone");
});

test("readProcessValue carries a readiness cone with per-cell witnesses", () => {
  const settled = settleProcess(null, createProcess({
    id: "rc",
    rows: [
      { e: "rc", a: "ready", v: "yes", t: "001" },
      { e: "rc", a: "ready", v: "yes", t: "002", op: "retract" },
    ],
  }));

  const value = readProcessValue(settled);

  assert.equal(value.value, "stable");
  assert.equal(value.cone.kind, "process.readiness-cone");
  assert.deepEqual(value.claims.map((claim) => claim.value), ["stable"]);
  assert.deepEqual(value.claims[0]?.witnesses, ["001", "002"]);
});

test("conserveEvidence flags folds that drop process evidence", () => {
  const settled = settleProcess(null, createProcess({
    id: "ev",
    rows: [{ e: "ev", a: "needs", v: "review", t: "001" }],
  }));

  assert.equal(conserveEvidence(settled, settled).conserved, true);
  const dropped = conserveEvidence(settled, { rows: [] });
  assert.equal(dropped.conserved, false);
  assert.ok(dropped.missing.length > 0);
});

test("readStructuration reads governance scope and withdrawals from the process document", () => {
  const structuration = readStructuration({
    id: "governed",
    doc: {
      governanceScope: "ship",
      withdrawals: ["office-a"],
      office: "dispatch",
    },
  });

  assert.equal(structuration.scope, "external-ship-work");
  assert.equal(structuration.hasWithdrawals, true);
  assert.deepEqual(structuration.officeField, ["dispatch"]);
});
