// boot.ts — kernel image readiness as memetic charges.
//
// A kernel image can be read two ways:
//   - as a MemeStore for the MMU/MPU-backed boot path;
//   - as a small charge carrier for platform/image readiness.
//
// This package only knows that an image can bind named interfaces.

import { MemeStore } from "@561-group/memetic-memory-unit";
import { Mpu } from "@561-group/memetic-processing-unit";
import { asMemeCharge, createMemeChargeCarrier, type MemeCharge, type MemeChargeCarrier } from "./charge.ts";
import { createProcess, settleProcess, type Process, type SettledProcess } from "./process.ts";

export type KernelStore = MemeStore;

export const KERNEL_IMAGE_KIND = "boot.kernel-image" as const;

export const KERNEL_IMAGE_STATES = Object.freeze([
  "image",
  "platform-bound",
  "arch-bound",
  "calculus-bound",
  "kernel-bound",
  "interfaces-bound",
  "userspace-bound",
  "ready",
] as const);
export type KernelImageState = typeof KERNEL_IMAGE_STATES[number];

export type BootComponent = Readonly<Record<string, unknown> & {
  name: string;
  charge?: MemeCharge;
}> | null;

export type KernelInterface = Readonly<{
  name: string;
  contract: string;
  owner: string;
  projection: string;
}>;

export type KernelInterfaceInput = string | Partial<KernelInterface> & {
  interface?: string;
};

export type KernelImage = Readonly<{
  kind: typeof KERNEL_IMAGE_KIND;
  id: string;
  name: string;
  arch: BootComponent;
  platform: BootComponent;
  calculus: BootComponent;
  kernel: BootComponent;
  interfaces: readonly KernelInterface[];
  userspace: readonly BootComponent[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type KernelImageInput = {
  id?: string;
  name?: string;
  arch?: string | Record<string, unknown> | null;
  platform?: string | Record<string, unknown> | null;
  calculus?: string | Record<string, unknown> | null;
  kernel?: string | Record<string, unknown> | null;
  interfaces?: Iterable<KernelInterfaceInput>;
  userspace?: Iterable<string | Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type BootedKernel = {
  kind: "kernel.booted";
  id: string;
  store: KernelStore;
  ready: boolean;
  value: MemeCharge;
  arch: string;
  platform: string;
  kernel: string;
  interfaces: readonly string[];
  userspace: readonly string[];
};

export type KernelImageProjection = Readonly<{
  id: string;
  name: string;
  point: string;
  arch: string;
  platform: string;
  calculus: string;
  kernel: string;
  interfaces: readonly string[];
  userspace: readonly string[];
  ready: boolean;
  value: MemeCharge;
}>;

export function createKernelImage(options: KernelImageInput = {}): KernelImage {
  const id = String(options.id ?? options.name ?? "kernel:memetics");

  return Object.freeze({
    kind: KERNEL_IMAGE_KIND,
    id,
    name: String(options.name ?? id),
    arch: normalizeComponent(options.arch),
    platform: normalizeComponent(options.platform),
    calculus: normalizeComponent(options.calculus ?? {
      name: "MemeCharge",
      substrate: "@561-group/memetics/charge",
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

export function kernelImagePoint(imageOrId: string | KernelImage): string {
  const id = typeof imageOrId === "string" ? imageOrId : imageOrId.id;
  if (!id) throw new TypeError("kernelImagePoint: image id is required");
  return `kernel-image:${id}`;
}

export function kernelImageCarrier(imageOrInput: KernelImage | KernelImageInput): MemeChargeCarrier<KernelImageState> {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const point = kernelImagePoint(image);

  return createMemeChargeCarrier([point], KERNEL_IMAGE_STATES, (_point, state) => {
    switch (state) {
      case "image":
        return "potential";
      case "arch-bound":
        return componentCharge(image.arch);
      case "platform-bound":
        return componentCharge(image.platform);
      case "calculus-bound":
        return componentCharge(image.calculus);
      case "kernel-bound":
        return componentCharge(image.kernel);
      case "interfaces-bound":
        return image.interfaces.length ? "potential" : "absurd";
      case "userspace-bound":
        return image.userspace.length ? "potential" : "absurd";
      case "ready":
        return imageReadyCharge(image);
    }
  });
}

export function imageReadyCharge(imageOrInput: KernelImage | KernelImageInput): MemeCharge {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const required: MemeCharge[] = [
    componentCharge(image.arch),
    componentCharge(image.platform),
    componentCharge(image.calculus),
    componentCharge(image.kernel),
    image.interfaces.length ? "potential" : "absurd",
    image.userspace.length ? "potential" : "absurd",
  ];

  if (required.includes("stable")) return "stable";
  if (required.includes("active")) return "active";
  if (required.includes("absurd")) return "absurd";
  return "potential";
}

export function bootImageProcess(imageOrInput: KernelImage | KernelImageInput): Process {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  return createProcess({
    id: `boot:${image.id}`,
    metadata: { imageId: image.id },
    judge: () => KERNEL_IMAGE_STATES
      .filter((state) => state !== "image")
      .map((state) => ({
        name: state,
        value: kernelImageCarrier(image).at(kernelImagePoint(image), state),
        reason: `boot carrier state ${state}`,
        path: kernelImagePoint(image),
      })),
  });
}

export function kernelInterfaceProcess(imageOrInput: KernelImage | KernelImageInput, interfaceName: string): Process {
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

export function settleKernelImage(imageOrInput: KernelImage | KernelImageInput): SettledProcess {
  return settleProcess(null, bootImageProcess(imageOrInput));
}

export function kernelImageProjection(imageOrInput: KernelImage | KernelImageInput): KernelImageProjection {
  const image = isKernelImage(imageOrInput) ? imageOrInput : createKernelImage(imageOrInput);
  const carrier = kernelImageCarrier(image);
  const point = kernelImagePoint(image);
  const value = carrier.at(point, "ready");

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

/** Create a kernel image MemeStore pre-populated with the given component Memes. */
export function createKernelStore(opts?: {
  id?: string;
  arch?: string;
  platform?: string;
  kernel?: string;
  interfaces?: readonly string[];
  userspace?: readonly string[];
  metadata?: Record<string, unknown>;
}): KernelStore {
  const store = new MemeStore();
  const id = opts?.id ?? `kernel-${nextKernelId++}`;
  const now = String(nextKernelId);

  const assert = (predicate: string, object: unknown): void => {
    store.store({ cell: { subject: id, predicate, object }, charge: { value: [true, false], evidence: [[now], []] } });
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

/** Read a kernel image MemeStore and validate readiness. Returns the booted kernel. */
export function bootKernel(store: KernelStore, opts?: { id?: string }): BootedKernel {
  const cells = store.cells();
  const kernelCell = cells.find((c) => c.predicate === "kernel");
  const id = opts?.id ?? (kernelCell ? String(kernelCell.subject) : "unknown");

  const mpu = new Mpu();
  for (const meme of store.memes) {
    if (String(meme.cell.subject) !== id) continue;
    if (meme.charge.value[0] && !meme.charge.value[1]) {
      mpu.articulate(meme.cell.subject, meme.cell.predicate, meme.cell.object);
    } else if (!meme.charge.value[0] && meme.charge.value[1]) {
      mpu.deny(meme.cell.subject, meme.cell.predicate, meme.cell.object);
    }
  }

  const claims = mpu.claimsFor(id);
  const arch = String(claims.find((c) => c.claim === "arch" && c.memeCharge === "potential")?.object ?? "");
  const platform = String(claims.find((c) => c.claim === "platform" && c.memeCharge === "potential")?.object ?? "");
  const kernel = String(claims.find((c) => c.claim === "kernel-name" && c.memeCharge === "potential")?.object ?? "");
  const interfaces = claims
    .filter((c) => c.claim === "interface" && c.memeCharge === "potential")
    .map((c) => String(c.object));
  const userspace = claims
    .filter((c) => c.claim === "userspace" && c.memeCharge === "potential")
    .map((c) => String(c.object));
  const value = asMemeCharge(mpu.memeCharge(id, "kernel", id));

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

function isKernelImage(value: unknown): value is KernelImage {
  return !!value && typeof value === "object" && (value as KernelImage).kind === KERNEL_IMAGE_KIND;
}

function normalizeInterface(item: KernelInterfaceInput): KernelInterface {
  if (typeof item === "string") return Object.freeze({ name: item, contract: "", owner: "", projection: "" });
  return Object.freeze({
    name: String(item.name ?? item.interface ?? ""),
    contract: String(item.contract ?? ""),
    owner: String(item.owner ?? ""),
    projection: String(item.projection ?? ""),
  });
}

function normalizeComponent(component: string | Record<string, unknown> | null | undefined): BootComponent {
  if (!component) return null;
  if (typeof component === "string") return Object.freeze({ name: component });
  return Object.freeze({
    ...component,
    name: String(component.name ?? component.id ?? component.kind ?? ""),
    ...(component.charge === undefined ? {} : { charge: asMemeCharge(component.charge) }),
  }) as BootComponent;
}

function componentCharge(component: BootComponent): MemeCharge {
  if (!component) return "absurd";
  if ("charge" in component && component.charge) return component.charge;
  return component.name ? "potential" : "absurd";
}
