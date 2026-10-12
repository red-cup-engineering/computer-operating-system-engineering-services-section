import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bootImageProcess,
  bootKernel,
  createKernelImage,
  createKernelStore,
  imageReadyCharge,
  kernelImageCarrier,
  kernelInterfaceProcess,
  kernelImagePoint,
  kernelImageProjection,
  settleKernelImage,
} from "./boot.mjs";
import { settleProcess } from "./process.mjs";

test("kernel image binds platform, arch, calculus, kernel, interfaces, and userspace", () => {
  const image = createKernelImage({
    id: "test",
    platform: { name: "host-js" },
    arch: { name: "host-js" },
    calculus: { name: "MemeCharge" },
    kernel: { name: "kernel", process: "@561-group/memetics/process" },
    interfaces: [{ name: "syscall", contract: "kernel syscall table", owner: "kernel" }],
    userspace: ["init"],
  });
  const carrier = kernelImageCarrier(image);
  const point = kernelImagePoint(image);

  assert.equal(carrier.kind, "meme-charge.carrier");
  assert.equal(carrier.at(point, "platform-bound"), "potential");
  assert.equal(carrier.at(point, "arch-bound"), "potential");
  assert.equal(carrier.at(point, "calculus-bound"), "potential");
  assert.equal(carrier.at(point, "kernel-bound"), "potential");
  assert.equal(carrier.at(point, "interfaces-bound"), "potential");
  assert.equal(carrier.at(point, "ready"), "potential");
  assert.equal(imageReadyCharge(image), "potential");
  assert.equal(kernelImageProjection(image).ready, true);
});

test("missing platform keeps the image unsettled", () => {
  const image = createKernelImage({
    id: "unsettled",
    platform: null,
    arch: null,
    interfaces: [{ name: "syscall", contract: "kernel syscall table", owner: "kernel" }],
    userspace: ["init"],
  });

  assert.equal(imageReadyCharge(image), "absurd");
  assert.equal(kernelImageProjection(image).ready, false);
  assert.equal(settleKernelImage(image).value, "absurd");
});

test("stable component is held during image boot", () => {
  const image = createKernelImage({
    id: "held",
    arch: { name: "host-js" },
    platform: { name: "host-js" },
    calculus: { name: "MemeCharge", charge: "stable" },
    interfaces: [{ name: "syscall", contract: "kernel syscall table", owner: "kernel" }],
    userspace: ["init"],
  });

  assert.equal(imageReadyCharge(image), "stable");
  assert.equal(settleKernelImage(image).contradicted, true);
});

test("boot image process is the kernel-image process face", () => {
  const process = bootImageProcess({
    id: "boot-process",
    arch: "host-js",
    platform: "host-js",
    interfaces: [{ name: "syscall", contract: "kernel syscall table", owner: "kernel" }],
    userspace: ["init"],
  });

  assert.equal(process.id, "boot:boot-process");
  assert.equal(settleProcess(null, process).ready, true);
});

test("kernelInterfaceProcess judges registered interface metadata", () => {
  const image = createKernelImage({
    id: "interfaces",
    platform: "host-js",
    interfaces: [{ name: "read", contract: "read syscall", owner: "kernel", projection: "syscall:read" }],
    userspace: ["init"],
  });
  const process = kernelInterfaceProcess(image, "read");
  const settled = settleProcess(null, process);

  assert.equal(process.id, "interface:read");
  assert.equal(settled.ready, true);
  assert.deepEqual(settled.judgments.map((judgment) => [judgment.name, judgment.value]), [
    ["interface-present", "potential"],
    ["contract-named", "potential"],
    ["kernel-owner", "potential"],
    ["projection-named", "potential"],
  ]);
});

test("kernelInterfaceProcess reports partial and missing interfaces as unsettled", () => {
  const image = createKernelImage({ id: "partial", platform: "host-js", interfaces: ["socket"], userspace: ["init"] });
  const partial = settleProcess(null, kernelInterfaceProcess(image, "socket"));
  const missing = settleProcess(null, kernelInterfaceProcess(image, "mqueue"));

  assert.equal(partial.value, "absurd");
  assert.equal(missing.value, "absurd");
  assert.equal(missing.judgments[0]?.reason, "interface is not registered in this kernel image");
});

test("store boot API still reads a kernel image MemeStore", () => {
  const store = createKernelStore({
    id: "store-kernel",
    arch: "host-js",
    platform: "host-js",
    kernel: "kernel",
    interfaces: ["syscall"],
    userspace: ["init"],
  });
  const booted = bootKernel(store);

  assert.equal(booted.id, "store-kernel");
  assert.equal(booted.ready, true);
  assert.deepEqual(booted.interfaces, ["syscall"]);
});
