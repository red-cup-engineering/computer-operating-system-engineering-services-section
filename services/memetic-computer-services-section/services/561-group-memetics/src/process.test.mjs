import test from "node:test";
import assert from "node:assert/strict";

import {
  ProcessRuntime,
  createProcess,
  judgmentState,
  processCarrier,
  processPoint,
  processProjection,
  settleProcess,
} from "./process.mjs";

test("processCarrier exposes process and named judgment states as MemeCharges", () => {
  const ready = settleProcess(null, createProcess({
    id: "ready",
    judge: () => [{ value: "potential", name: "capability", reason: "test", path: "capability" }],
  }));
  const contradicted = settleProcess(null, createProcess({
    id: "contradicted",
    judge: () => [
      { value: "potential", name: "capability", reason: "granted", path: "capability" },
      { value: "stable", name: "capability", reason: "contested", path: "capability" },
    ],
  }));

  const carrier = processCarrier([ready, contradicted]);

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at(processPoint("ready"), "present"), "potential");
  assert.equal(carrier.at(processPoint("ready"), "admitted"), "potential");
  assert.equal(carrier.at(processPoint("ready"), "denied"), "active");
  assert.equal(carrier.at(processPoint("contradicted"), "contradicted"), "potential");
  assert.equal(carrier.at(processPoint("contradicted"), judgmentState("capability")), "stable");
  assert.equal(carrier.at("process:missing", "present"), "absurd");
});

test("processProjection summarizes settled carrier state", () => {
  const settled = settleProcess(null, createProcess({
    id: "blocked",
    judge: () => [{ value: "active", name: "capability", reason: "denied", path: "capability" }],
  }));

  assert.deepEqual(processProjection(settled), {
    id: "blocked",
    point: "process:blocked",
    value: "active",
    judgmentCount: 1,
    present: true,
    admitted: false,
    denied: true,
    unsettled: false,
    contradicted: false,
  });
});

test("ProcessRuntime exposes carrier and projection views", () => {
  const runtime = new ProcessRuntime();
  runtime.spawn({
    id: "proc",
    judge: () => [{ value: "potential", name: "ready", reason: "test", path: "ready" }],
  });

  assert.equal(runtime.carrier().at("process:proc", "admitted"), "potential");
  assert.equal(runtime.projection("proc").value, "potential");
});
