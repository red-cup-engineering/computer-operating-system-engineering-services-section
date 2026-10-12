/**
 * One physical host's effect executor. This belongs to the host, not an agent/provider.
 *
 * The host owner supplies its exclusive transaction, current governing assays and
 * kernel containment adapter. A caller cannot supply a permit, proof, cost or handler.
 * Provider/account quotas remain additional restrictions, never physical capacity.
 *
 * Necessary installation conditions:
 * - all local tools, worker launch, workspace/index creation and background effects
 *   invoke this executor; agents cannot access its custody or raw host execution;
 * - the owner transaction and containment cover the SAME physical host (Windows,
 *   its WSL virtual disks, swap and all provider processes);
 * - containment bounds the actual process tree, memory, IO and output and survives
 *   client disconnect; restart reconciles live effects before allowing admission;
 * - resolved institutional authority and governing research/standards are assayed
 *   for the exact operation and arguments. Testimony or an agent's label is no proof.
 *
 * Refuse when any condition cannot be witnessed. Hooks are routing conveniences,
 * not containment. No timer, per-provider lock directory or polling ledger is needed.
 */
import { isDeepStrictEqual, types } from "node:util";

export const MAX_EFFECT_REQUEST_BYTES = 65_536;
const byteLengthOf = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** The untrusted entry is a finite wire message, never a JavaScript object.
 * Check the byte bound BEFORE decoding/parsing; do not stringify caller objects
 * or execute getters, toJSON, proxy traps or iterator methods during admission.
 * The transport must also stop collecting bytes at this bound, not read a whole
 * stream and then pass a bounded response to this decoder. */
export function decodeHostEffectRequest(wire) {
  if (types.isProxy(wire)) throw new TypeError("effect wire data required");
  let text;
  if (typeof wire === "string") {
    if (wire.length > MAX_EFFECT_REQUEST_BYTES || Buffer.byteLength(wire, "utf8") > MAX_EFFECT_REQUEST_BYTES)
      throw new RangeError("effect request exceeds byte bound");
    text = wire;
  } else if (types.isUint8Array(wire)) {
    if (byteLengthOf.call(wire) > MAX_EFFECT_REQUEST_BYTES) throw new RangeError("effect request exceeds byte bound");
    text = utf8.decode(wire);
  } else throw new TypeError("effect wire data required");
  const data = JSON.parse(text);
  let nodes = 0;
  const freeze = (value, depth) => {
    if (++nodes > 4096 || depth > 32) throw new RangeError("effect request exceeds structural bound");
    if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("finite JSON numbers required");
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child, depth + 1);
      Object.freeze(value);
    }
  };
  freeze(data, 0);
  return data;
}

export const RESOURCE_DIMENSIONS = Object.freeze([
  "memoryBytes", "readBytes", "writeBytes", "processes", "cpuMillis",
]);
// Capture JSON data once before the first await. Mutation by the initiating agent
// must not change what the owning authority assayed or what admission reserved.
const capture = value => {
  const freeze = x => {
    if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); }
    return x;
  };
  return freeze(JSON.parse(JSON.stringify(value)));
};
const sameRequest = (a, b) => isDeepStrictEqual(a, b);
const vector = (value) => {
  if (!value || RESOURCE_DIMENSIONS.some(k => !Number.isSafeInteger(value[k]) || value[k] < 0))
    throw new TypeError("complete nonnegative safe-integer resource vector required");
  return Object.freeze(Object.fromEntries(RESOURCE_DIMENSIONS.map(k => [k, value[k]])));
};
const refuse = (reason, detail = undefined) => Object.freeze({
  kind: "host-resource.refused", reason, ...(detail === undefined ? {} : { detail }),
});

/** Admission is a finite additive budget, not an inferred concurrency count.
 * Safe integer checks prevent overflow from turning an oversized request negative. */
export function resourceBudgetFits(limit, active, next) {
  limit = vector(limit); next = vector(next);
  const total = Object.fromEntries(RESOURCE_DIMENSIONS.map(k => [k, next[k]]));
  for (const item of active) for (const k of RESOURCE_DIMENSIONS) {
    const n = vector(item)[k];
    if (n > limit[k] - total[k]) return false;
    total[k] += n;
  }
  return RESOURCE_DIMENSIONS.every(k => total[k] <= limit[k]);
}

/** Physical storage observations must cover every touched backing volume. Linux
 * statfs free space is insufficient for a WSL file backed by a Windows VHD. */
export function hostPressureRefusal(host, cost, policy, now) {
  if (!host || host.physicalHost !== policy.physicalHost || !Number.isFinite(host.observedAt)
      || now < host.observedAt || now - host.observedAt > policy.maxObservationAgeMs)
    return "physical-host-observation-unavailable";
  if (!Number.isSafeInteger(host.availableMemoryBytes)
      || host.availableMemoryBytes - cost.memoryBytes < policy.memoryReserveBytes)
    return "physical-host-memory-pressure";
  // Windows may still have free RAM while the shared commit limit is exhausted.
  // Guest free memory and a pagefile's configured size do not witness this room.
  if (!Number.isSafeInteger(host.availableCommitBytes)
      || host.availableCommitBytes - cost.memoryBytes < policy.commitReserveBytes)
    return "physical-host-commit-pressure";
  if (!Array.isArray(host.volumes) || host.volumes.length === 0) return "backing-volume-unobserved";
  for (const id of policy.backingVolumes) {
    const volume = host.volumes.find(v => v.id === id);
    if (!volume || !Number.isSafeInteger(volume.freeBytes)) return "backing-volume-unobserved";
    if (volume.freeBytes - cost.writeBytes < policy.diskReserveBytes) return "backing-volume-pressure";
  }
  if (!Number.isFinite(host.diskQueueLength) || host.diskQueueLength < 0
      || host.diskQueueLength > policy.maxDiskQueueLength) return "physical-host-io-pressure";
  return undefined;
}

/** The adapters are HOST-OWNER capabilities, never request fields.
 * transact reads/writes existing host custody atomically across every process;
 * contain prepares a suspended effect and returns start/join/cancel/receipt.
 * It must not execute while preparing. reconcile cannot declare live work absent.
 */
export function createHostResourceExecutor({ operations, policy, transact, observe,
  assayAuthority, assayConformance, contain, now = Date.now }) {
  policy = capture(policy);
  // Capture the owning definitions before asynchronous assays. Replacing a
  // bound/validator on the originally supplied object must not change the
  // assayed operation or reduce its reservation while admission is in flight.
  operations = new Map([...operations].map(([name, definition]) =>
    [name, Object.freeze({ ...definition })]));
  const limits = vector(policy.limits);
  if (typeof transact !== "function" || typeof observe !== "function"
      || typeof assayAuthority !== "function" || typeof assayConformance !== "function"
      || typeof contain !== "function") throw new TypeError("all owning effect capabilities required");
  if (typeof policy.physicalHost !== "string" || !policy.physicalHost || !Array.isArray(policy.backingVolumes)
      || policy.backingVolumes.length === 0 || !Number.isSafeInteger(policy.maxObservationAgeMs)
      || policy.backingVolumes.some(x => typeof x !== "string" || !x)
      || !Number.isSafeInteger(policy.ioWindowMs) || policy.ioWindowMs <= 0
      || policy.maxObservationAgeMs <= 0 || !Number.isSafeInteger(policy.memoryReserveBytes)
      || policy.memoryReserveBytes < 0 || !Number.isSafeInteger(policy.diskReserveBytes)
      || !Number.isSafeInteger(policy.commitReserveBytes) || policy.commitReserveBytes < 0
      || policy.diskReserveBytes < 0 || !Number.isFinite(policy.maxDiskQueueLength)
      || policy.maxDiskQueueLength < 0) throw new TypeError("complete physical host policy required");
  return Object.freeze({ async execute(wire) {
    let request;
    try { request = decodeHostEffectRequest(wire); }
    catch { return refuse("invalid-effect-request"); }
    // Never accept caller-provided callbacks, resource bounds or permits.
    if (!request || Object.keys(request).some(k => !["id", "actor", "session", "office", "subject", "operation", "input"].includes(k))
        || ["id", "actor", "session", "office", "subject", "operation"].some(k => typeof request[k] !== "string" || !request[k]))
      return refuse("invalid-effect-request");
    // Stable field order also makes the immutable effect ID independent of the
    // sender's JSON property order. Undefined / executable input is not admitted.
    try {
      request = capture(Object.fromEntries(["id", "actor", "session", "office", "subject", "operation", "input"].map(k => [k, request[k]])));
      if (!("input" in request)) return refuse("invalid-effect-request");
    } catch { return refuse("invalid-effect-request"); }
    const op = operations.get(request.operation);
    if (!op || typeof op.validate !== "function" || !op.validate(request.input)) return refuse("unknown-or-invalid-operation");
    const authority = await assayAuthority(request);
    if (authority?.accepted !== true || authority?.against === true || !authority?.receipt) return refuse("authority-unproven");
    const conformance = await assayConformance(request, op);
    if (conformance?.accepted !== true || conformance?.against === true || !conformance?.receipt)
      return refuse("governing-conformance-unproven");
    const cost = vector(op.bound(request.input));
    const observation = await observe();
    let prepared;
    // Atomic admission before preparation/start. Idempotency is the original effect
    // ID; a timeout must read this state rather than execute the effect again.
    const custody = change => transact(change, { id: request.id, ioWindowMs: policy.ioWindowMs });
    const admission = await custody(state => {
      if (state.physicalHost !== policy.physicalHost || state.reconciled !== true || !state.effects)
        return refuse("host-effects-not-reconciled");
      if (Object.hasOwn(state.effects, request.id)) {
        const existing = state.effects[request.id];
        return sameRequest(existing.request, request)
          ? Object.freeze({ kind: "host-resource.existing", effect: capture(existing) })
          : refuse("effect-id-conflict");
      }
      const active = Object.values(state.effects).filter(e => e.status !== "received");
      if (!resourceBudgetFits(limits, active.map(e => e.cost), cost)) return refuse("host-budget-full");
      // Finished work still consumed IO. Retain its debit for the owning budget
      // window; sequential small requests cannot evade the aggregate IO bound.
      const windowCosts = Object.values(state.effects).filter(e => e.status !== "received"
        || !Number.isFinite(e.receivedAt) || now() - e.receivedAt < policy.ioWindowMs)
        .map(e => ({ ...vector(e.cost), memoryBytes: 0, processes: 0, cpuMillis: 0 }));
      if (!resourceBudgetFits(limits, windowCosts, { ...cost, memoryBytes: 0, processes: 0, cpuMillis: 0 }))
        return refuse("host-io-window-full");
      const sum = Object.fromEntries(RESOURCE_DIMENSIONS.map(k => [k, cost[k] + active.reduce((n, e) => n + e.cost[k], 0)]));
      const pressure = hostPressureRefusal(observation, sum, policy, now());
      if (pressure) return refuse(pressure);
      Object.defineProperty(state.effects, request.id, { enumerable: true, configurable: true, writable: true,
        value: { request, cost, status: "reserved", authority: authority.receipt,
          conformance: conformance.receipt, observedAt: observation.observedAt } });
      return { kind: "host-resource.admitted", id: request.id };
    });
    if (admission.kind !== "host-resource.admitted") return admission;
    try {
      prepared = await contain({ request, operation: op, cost, physicalHost: policy.physicalHost });
      if (prepared?.physicalHost !== policy.physicalHost || prepared?.bounded !== true
          || prepared.receipt?.id !== request.id || typeof prepared.start !== "function" || typeof prepared.join !== "function")
        throw new Error("actual host containment unavailable");
      const launching = await custody(state => {
        state.effects[request.id].status = "executing";
        state.effects[request.id].containment = prepared.receipt;
        return { kind: "host-resource.executing", id: request.id };
      });
      if (launching?.kind !== "host-resource.executing") {
        await prepared.cancel?.();
        return Object.freeze({ kind: "host-resource.pending", id: request.id,
          reason: launching?.reason ?? "executing-custody-unproven" });
      }
      await prepared.start();
      const receipt = await prepared.join();
      // An error or timeout is not evidence that the whole effect tree ended.
      if (receipt?.terminated !== true || receipt.id !== request.id) throw new Error("original effect termination not witnessed");
      const receiving = await custody(state => {
        state.effects[request.id].status = "received"; state.effects[request.id].receipt = receipt;
        state.effects[request.id].receivedAt = now();
        return { kind: "host-resource.received", id: request.id };
      });
      if (receiving?.kind !== "host-resource.received") return Object.freeze({
        kind: "host-resource.pending", id: request.id,
        reason: receiving?.reason ?? "receiving-custody-unproven" });
      return Object.freeze({ kind: "host-resource.received", id: request.id, receipt });
    } catch (error) {
      // Retain custody and the reservation until an independent host observation
      // proves no live effect remains. Never free capacity on a lost connection.
      await custody(state => { state.effects[request.id].status = "uncertain"; state.effects[request.id].error = String(error); });
      return Object.freeze({ kind: "host-resource.pending", id: request.id, reason: String(error) });
    }
  } });
}

