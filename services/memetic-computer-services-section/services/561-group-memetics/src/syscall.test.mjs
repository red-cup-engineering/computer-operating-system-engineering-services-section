import test from "node:test";
import assert from "node:assert/strict";

import { createProcess } from "./process.mjs";
import {
  SyscallTable,
  createSyscallEntry,
  dispatchCarrier,
  dispatchPoint,
  dispatchSyscall,
  normalizeSyscallResult,
  settleSyscallEntry,
  syscallCarrier,
  syscallPoint,
} from "./syscall.mjs";

test("SyscallTable resolves entries by name and number", () => {
  const table = new SyscallTable([
    { name: "read", number: 0, handler: () => 0 },
    { name: "write", number: 1, handler: () => 0 },
  ]);

  assert.equal(table.resolve("read")?.name, "read");
  assert.equal(table.resolve(1)?.name, "write");
  assert.equal(table.has(0), true);
  assert.equal(table.has("missing"), false);
});

test("settleSyscallEntry admits implemented potential entries and denies missing handlers", () => {
  const admitted = settleSyscallEntry(createSyscallEntry({ name: "stat", handler: () => 0 }));
  const denied = settleSyscallEntry(createSyscallEntry("unimplemented"));

  assert.equal(admitted.admitted, true);
  assert.equal(admitted.implemented, true);
  assert.equal(denied.denied, true);
  assert.equal(denied.implemented, false);
});

test("syscallCarrier exposes registered table entries as MemeCharge states", () => {
  const table = new SyscallTable([
    { name: "read", number: 0, handler: () => 0 },
    { name: "sleep", handler: null },
  ]);
  const carrier = syscallCarrier(table);

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at(syscallPoint({ name: "read", number: 0 }), "registered"), "potential");
  assert.equal(carrier.at(syscallPoint({ name: "read", number: 0 }), "numbered"), "potential");
  assert.equal(carrier.at(syscallPoint({ name: "read", number: 0 }), "implemented"), "potential");
  assert.equal(carrier.at(syscallPoint("sleep"), "implemented"), "active");
  assert.equal(carrier.at(syscallPoint("sleep"), "denied"), "potential");
  assert.equal(table.carrier().at(syscallPoint("sleep"), "admitted"), "active");
  assert.equal(carrier.at("syscall:missing", "registered"), "absurd");
});

test("dispatchSyscall reports missing table entries as unimplemented with a trap trace", () => {
  const dispatch = dispatchSyscall(new SyscallTable(), createProcess("proc"), "missing", [], { at: 8 });

  assert.equal(dispatch.ok, false);
  assert.equal(dispatch.error, "unimplemented-syscall");
  assert.equal(dispatch.returnValue, -1);
  assert.equal(dispatch.entry, null);
  assert.equal(dispatch.trap.rows.length, 3);
  assert.equal(dispatch.instant.tick, 8);
});

test("dispatchSyscall denies entries whose judgments do not admit dispatch", () => {
  const table = new SyscallTable([
    {
      name: "mount",
      handler: () => 0,
      judgments: [{ value: "active", name: "capability", reason: "not delegated", path: "office" }],
    },
  ]);

  const dispatch = table.dispatch(createProcess("proc"), "mount");

  assert.equal(dispatch.ok, false);
  assert.equal(dispatch.error, "denied-syscall");
  assert.equal(dispatch.settled?.denied, true);
});

test("dispatchSyscall normalizes successful handler returns and keeps resources", () => {
  const table = new SyscallTable([
    {
      name: "read",
      number: 0,
      resources: { surface: "fd" },
      handler: ({ args, trap }) => ({
        ok: true,
        returnValue: args.length,
        residues: [trap.rows[0]],
        resources: { bytes: 16 },
      }),
    },
  ]);

  const dispatch = table.dispatch(createProcess("proc"), 0, [3, 16], { at: { tick: 2, label: "sys-2" } });

  assert.equal(dispatch.ok, true);
  assert.equal(dispatch.syscall, "read");
  assert.equal(dispatch.returnValue, 2);
  assert.deepEqual(dispatch.resources, { surface: "fd", bytes: 16 });
  assert.equal(dispatch.report.residues.length, 1);
  assert.equal(dispatch.report.charge.value, "potential");
  assert.equal(dispatch.report.evidence[0].length, 1);
  assert.equal(dispatch.report.evidence[1].length, 0);
  assert.deepEqual(dispatch.report.witnesses, dispatch.report.evidence);
  assert.equal(dispatchPoint(dispatch), "dispatch:proc:read:sys-2");
});

test("dispatchSyscall reports preserve MemeCharge evidence polarity", () => {
  const table = new SyscallTable([
    { name: "ok", handler: () => 1 },
    {
      name: "held",
      handler: () => 0,
      judgments: [{ value: "stable", name: "authority", reason: "contended", path: "office" }],
    },
  ]);

  const ok = table.dispatch(createProcess("proc"), "ok");
  const missing = table.dispatch(createProcess("proc"), "missing");
  const held = table.dispatch(createProcess("proc"), "held");

  assert.equal(ok.report.value, "potential");
  assert.equal(ok.report.charge.value, "potential");
  assert.equal(ok.report.evidence[0].length, 1);
  assert.equal(ok.report.evidence[1].length, 0);

  assert.equal(missing.report.value, "active");
  assert.equal(missing.report.charge.value, "active");
  assert.equal(missing.report.evidence[0].length, 0);
  assert.equal(missing.report.evidence[1].length, 1);

  assert.equal(held.report.value, "stable");
  assert.equal(held.report.charge.value, "stable");
  assert.equal(held.report.evidence[0].length, 1);
  assert.equal(held.report.evidence[1].length, 1);
  assert.deepEqual(held.report.witnesses, held.report.evidence);
});

test("dispatchCarrier exposes dispatch trap and result states", () => {
  const table = new SyscallTable([{ name: "read", number: 0, handler: () => 3 }]);
  const success = table.dispatch(createProcess("proc"), 0, [], { at: 1 });
  const missing = table.dispatch(createProcess("proc"), "missing", [], { at: 2 });
  const carrier = dispatchCarrier([missing, success]);

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at(dispatchPoint(success), "dispatched"), "potential");
  assert.equal(carrier.at(dispatchPoint(success), "trapped"), "potential");
  assert.equal(carrier.at(dispatchPoint(success), "admitted"), "potential");
  assert.equal(carrier.at(dispatchPoint(success), "succeeded"), "potential");
  assert.equal(carrier.at(dispatchPoint(success), "failed"), "active");
  assert.equal(carrier.at(dispatchPoint(missing), "failed"), "potential");
  assert.equal(carrier.at(dispatchPoint(missing), "unimplemented"), "potential");
  assert.equal(carrier.at("dispatch:missing", "dispatched"), "absurd");
});

test("dispatchSyscall lets handler exceptions propagate", () => {
  const table = new SyscallTable([{ name: "boom", handler: () => { throw new Error("boom"); } }]);

  assert.throws(() => table.dispatch(createProcess("proc"), "boom"), /boom/);
});

test("normalizeSyscallResult accepts raw values and structured failures", () => {
  assert.deepEqual(normalizeSyscallResult(7), {
    ok: true,
    returnValue: 7,
    error: null,
    result: 7,
    residues: [],
    resources: undefined,
  });

  assert.deepEqual(normalizeSyscallResult({ ok: false, error: "fault", residues: ["r"] }), {
    ok: false,
    returnValue: -1,
    error: "fault",
    result: { ok: false, error: "fault", residues: ["r"] },
    residues: ["r"],
    resources: undefined,
  });
});
