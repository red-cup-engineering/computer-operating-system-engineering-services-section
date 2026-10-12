import test from "node:test";
import assert from "node:assert/strict";

import { createProcess } from "./process.mjs";
import {
  KernelClock,
  compareInstants,
  createKernelInstant,
  instantPoint,
  scheduleCarrier,
  scheduleProcess,
  scheduleProcesses,
  syscallTrap,
  timeCarrier,
} from "./scheduler.mjs";

test("KernelClock advances ordered kernel instants", () => {
  const clock = new KernelClock({ tick: 4, label: "boot", wallTime: "2026-06-07T00:00:00.000Z" });

  assert.equal(clock.now().tick, 4);
  assert.equal(clock.now().label, "boot");

  const next = clock.tick({ step: 2 });
  assert.equal(next.tick, 6);
  assert.equal(next.label, "6");
  assert.equal(compareInstants(clock.now(), { tick: 7 }), -1);
  assert.equal(compareInstants(clock.now(), 6), 0);
});

test("timeCarrier reads kernel time as MemeCharge relations", () => {
  const now = createKernelInstant(2);
  const carrier = timeCarrier([0, 2, { tick: 3, wallTime: "host" }], now);

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at(instantPoint(0), "past"), "potential");
  assert.equal(carrier.at(instantPoint(now), "current"), "potential");
  assert.equal(carrier.at(instantPoint(3), "future"), "potential");
  assert.equal(carrier.at(instantPoint(3), "wall-clock"), "potential");
  assert.equal(carrier.at("instant:missing", "current"), "absurd");
  assert.equal(new KernelClock(now).carrier([0, now]).at(instantPoint(now), "current"), "potential");
});

test("scheduleProcesses partitions runnable, sleeping, blocked, and contradicted processes", () => {
  const ready = createProcess("ready");
  const future = scheduleProcess(createProcess("future"), { notBefore: 5 });
  const blocked = createProcess({ id: "blocked", after: ["ready"], rows: [] });
  const contradicted = createProcess("contradicted");
  const judge = (proc) => {
    if (proc.id === "contradicted") return [{ value: "stable", name: "contradicted", reason: "test", path: proc.id }];
    return [{ value: "potential", name: "ready", reason: "test", path: proc.id }];
  };

  const queue = scheduleProcesses([future, blocked, ready, contradicted], { now: 1, judge });

  assert.deepEqual(queue.runnable.map((decision) => decision.process.id), ["ready"]);
  assert.deepEqual(queue.sleeping.map((decision) => decision.process.id), ["future"]);
  assert.deepEqual(queue.blocked.map((decision) => decision.process.id), ["blocked"]);
  assert.deepEqual(queue.contradicted.map((decision) => decision.process.id), ["contradicted"]);
});

test("scheduleCarrier exposes scheduled process state as MemeCharges", () => {
  const judge = (proc) => [{ value: "potential", name: "ready", reason: "test", path: proc.id }];
  const carrier = scheduleCarrier([
    scheduleProcess("run", { notBefore: 0 }),
    scheduleProcess("sleep", { notBefore: 2 }),
  ], 1, { judge });

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at("process:run", "scheduled"), "potential");
  assert.equal(carrier.at("process:run", "runnable"), "potential");
  assert.equal(carrier.at("process:sleep", "sleeping"), "potential");
  assert.equal(carrier.at("process:sleep", "runnable"), "active");
  assert.equal(carrier.at("process:missing", "runnable"), "absurd");
});

test("scheduleProcesses orders runnable work by due time, priority, then process id", () => {
  const judge = (proc) => [{ value: "potential", name: "ready", reason: "test", path: proc.id }];
  const queue = scheduleProcesses([
    scheduleProcess("low", { priority: 1 }),
    scheduleProcess("high-b", { priority: 5 }),
    scheduleProcess("high-a", { priority: 5 }),
  ], { judge });

  assert.deepEqual(queue.runnable.map((decision) => decision.process.id), ["high-a", "high-b", "low"]);
});

test("syscallTrap records syscall facts at a kernel instant", () => {
  const trap = syscallTrap(createProcess("proc"), "read", [0, 16], { at: { tick: 3, label: "irq-3" } });

  assert.equal(trap.kind, "kernel.scheduler.syscall-trap");
  assert.equal(trap.syscall, "read");
  assert.equal(trap.instant.label, "irq-3");
  assert.deepEqual(trap.rows, [
    { e: "proc", a: "syscall", v: "read", t: "irq-3" },
    { e: "proc", a: "syscall-ordinal", v: "irq-3", t: "irq-3" },
    { e: "proc", a: "syscall-args", v: [0, 16], t: "irq-3" },
  ]);
});
