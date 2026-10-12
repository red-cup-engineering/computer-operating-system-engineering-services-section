// boot.ts — kernel image readiness as readings.
//
// A kernel image can be read two ways:
//   - as a telling log for the knowledge-base-backed boot path;
//   - as a small Chu space of platform/image readiness.
//
// This package only knows that an image can bind named interfaces.

import { knowledgeReading } from "@red-cup-engineering/signcell/cell";
import { TellingLog } from "@red-cup-engineering/signchain/log";
import { KnowledgeBase } from "@red-cup-engineering/signcraft/knowledge-base";
import { at, chuSpace } from "@red-cup-engineering/metrologic/chu";
import { createProcess, settleProcess } from "./process.mjs";
import { readingAs, truthMeetAll } from "@red-cup-engineering/computer-data-engineering-services-section/four";

export const KERNEL_IMAGE_KIND = "boot.kernel-image";

export const KERNEL_IMAGE_STATES = Object.freeze([
  "image",
  "platform-bound",
  "arch-bound",
  "calculus-bound",
  "kernel-bound",
  "interfaces-bound",
  "userspace-bound",
  "ready",
]);

export function createKernelImage(options = {}) {
  const id = String(options.id ?? options.name ?? "kernel:memetics");

  return Object.freeze({
    kind: KERNEL_IMAGE_KIND,
    id,
    name: String(options.name ?? id),
    arch: normalizeComponent(options.arch),
    platform: normalizeComponent(options.platform),
    calculus: normalizeComponent(options.calculus ?? {
      name: "reading",
      substrate: "@red-cup-engineering/signchain/bilattice",
      value: "potential|active|absurd|stable",
    }),
    kernel: normalizeComponent(options.kernel ?? {
      name: "kernel",
      process: "@561-group/memetics/process",
    }),
    interfaces: Object.freeze([...(options.interfaces ?? [])].map(normalizeInterface)),
    userspace: Object.freeze([...(options.userspace ?? [])].map(normalizeComponent)),
    metadata: Object.freeze({ ...(options.metadata ?? {}) }),
  });
}

export function kernelImagePoint(imageOrId) {
  const id = typeof imageOrId === "string" ? imageOrId : imageOrId.id;
  if (!id) throw new TypeError("kernelImagePoint: image id is required");
  return `kernel-image:${id}`;
}

export function kernelImageCarrier(imageOrInput) {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const point = kernelImagePoint(image);

  return chuSpace([point], KERNEL_IMAGE_STATES, (_point, state) => {
    switch (state) {
      case "image":
        return "potential";
      case "arch-bound":
        return componentReading(image.arch);
      case "platform-bound":
        return componentReading(image.platform);
      case "calculus-bound":
        return componentReading(image.calculus);
      case "kernel-bound":
        return componentReading(image.kernel);
      case "interfaces-bound":
        return image.interfaces.length ? "potential" : "absurd";
      case "userspace-bound":
        return image.userspace.length ? "potential" : "absurd";
      case "ready":
        return imageReadyReading(image);
    }
  });
}

export function imageReadyReading(imageOrInput) {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const required = [
    componentReading(image.arch),
    componentReading(image.platform),
    componentReading(image.calculus),
    componentReading(image.kernel),
    image.interfaces.length ? "potential" : "absurd",
    image.userspace.length ? "potential" : "absurd",
  ];

  // An image is ready when every required component is: the truth meet of their readings.
  return truthMeetAll(required.map((reading) => readingAs("knowledge", reading)), "knowledge");
}

export function bootImageProcess(imageOrInput) {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  return createProcess({
    id: `boot:${image.id}`,
    metadata: { imageId: image.id },
    judge: () => KERNEL_IMAGE_STATES
      .filter((state) => state !== "image")
      .map((state) => ({
        name: state,
        value: at(kernelImageCarrier(image), kernelImagePoint(image), state),
        reason: `boot carrier state ${state}`,
        path: kernelImagePoint(image),
      })),
  });
}

export function kernelInterfaceProcess(imageOrInput, interfaceName) {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const name = String(interfaceName ?? "");
  const iface = image.interfaces.find((item) => item.name === name);
  if (!iface) {
    return createProcess({
      id: `interface:${name}`,
      metadata: { imageId: image.id },
      judge: () => [{
        name: "interface-present",
        value: "absurd",
        reason: "interface is not registered in this kernel image",
        path: kernelImagePoint(image),
      }],
    });
  }

  return createProcess({
    id: `interface:${iface.name}`,
    metadata: {
      imageId: image.id,
      contract: iface.contract,
      owner: iface.owner,
      projection: iface.projection,
    },
    judge: () => [
      {
        name: "interface-present",
        value: "potential",
        reason: `${iface.name} is registered`,
        path: kernelImagePoint(image),
      },
      {
        name: "contract-named",
        value: iface.contract ? "potential" : "absurd",
        reason: "interface contract must be named",
        path: kernelImagePoint(image),
      },
      {
        name: "kernel-owner",
        value: iface.owner ? "potential" : "absurd",
        reason: "kernel owner must be named",
        path: kernelImagePoint(image),
      },
      {
        name: "projection-named",
        value: iface.projection ? "potential" : "absurd",
        reason: "projection surface may be named by the owning package",
        path: kernelImagePoint(image),
      },
    ],
  });
}

export function settleKernelImage(imageOrInput) {
  return settleProcess(null, bootImageProcess(imageOrInput));
}

export function kernelImageProjection(imageOrInput) {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const carrier = kernelImageCarrier(image);
  const point = kernelImagePoint(image);
  const value = at(carrier, point, "ready");

  return Object.freeze({
    id: image.id,
    name: image.name,
    point,
    arch: image.arch?.name ?? "",
    platform: image.platform?.name ?? "",
    calculus: image.calculus?.name ?? "",
    kernel: image.kernel?.name ?? "",
    interfaces: Object.freeze(image.interfaces.map((surface) => surface.name)),
    userspace: Object.freeze(image.userspace.map((program) => program?.name ?? "")),
    ready: value === "potential",
    value,
  });
}

// ── store creation and boot ─────────────────────────────────────────────────────────────────────

let nextKernelId = 1;

/** Create a kernel image: a telling log of the kernel's component claims. */
export function createKernelStore(opts

) {
  const store = new TellingLog();
  const id = opts?.id ?? `kernel-${nextKernelId++}`;
  const now = String(nextKernelId);

  const assert = (predicate, object) => {
    store.tell({ subject: id, predicate, object }, now);
  };

  assert("kernel", id);
  if (opts?.arch) assert("arch", opts.arch);
  if (opts?.platform) assert("platform", opts.platform);
  if (opts?.kernel) assert("kernel-name", opts.kernel);
  for (const s of opts?.interfaces ?? []) assert("interface", s);
  for (const u of opts?.userspace ?? []) assert("userspace", u);
  if (opts?.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) assert(`meta.${k}`, v);
  }

  return store;
}

/** Read a kernel image (a telling log) and validate readiness. Returns the booted kernel. */
export function bootKernel(store, opts) {
  const kernelRow = store.rows.find((row) => row.predicate === "kernel");
  const id = opts?.id ?? (kernelRow ? String(kernelRow.subject) : "unknown");

  const kb = new KnowledgeBase();
  for (const row of store.rows) {
    if (String(row.subject) !== id) continue;
    if (row.side === "for") kb.articulate(row.subject, row.predicate, row.object);
    else kb.deny(row.subject, row.predicate, row.object);
  }

  const claims = kb.claimsFor(id).map((told) => ({ claim: told.predicate, object: told.object, reading: knowledgeReading(told) }));
  const arch = String(claims.find((c) => c.claim === "arch" && c.reading === "potential")?.object ?? "");
  const platform = String(claims.find((c) => c.claim === "platform" && c.reading === "potential")?.object ?? "");
  const kernel = String(claims.find((c) => c.claim === "kernel-name" && c.reading === "potential")?.object ?? "");
  const interfaces = claims
    .filter((c) => c.claim === "interface" && c.reading === "potential")
    .map((c) => String(c.object));
  const userspace = claims
    .filter((c) => c.claim === "userspace" && c.reading === "potential")
    .map((c) => String(c.object));
  const value = readingAs("knowledge", kb.readingAt(id, "kernel", id));

  return Object.freeze({
    kind: "kernel.booted",
    id,
    store,
    ready: value === "potential",
    value,
    arch,
    platform,
    kernel,
    interfaces: Object.freeze(interfaces),
    userspace: Object.freeze(userspace),
  });
}

function isKernelImage(value) {
  return !!value && typeof value === "object" && (value).kind === KERNEL_IMAGE_KIND;
}

function normalizeInterface(item) {
  if (typeof item === "string") return Object.freeze({ name: item, contract: "", owner: "", projection: "" });
  return Object.freeze({
    name: String(item.name ?? item.interface ?? ""),
    contract: String(item.contract ?? ""),
    owner: String(item.owner ?? ""),
    projection: String(item.projection ?? ""),
  });
}

function normalizeComponent(component) {
  if (!component) return null;
  if (typeof component === "string") return Object.freeze({ name: component });
  return Object.freeze({
    ...component,
    name: String(component.name ?? component.id ?? component.kind ?? ""),
    ...(component.reading === undefined ? {} : { reading: readingAs("knowledge", component.reading) }),
  });
}

function componentReading(component) {
  if (!component) return "absurd";
  if ("reading" in component && component.reading) return component.reading;
  return component.name ? "potential" : "absurd";
}
