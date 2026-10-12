// index.ts — @561-group/memetics: Meme Trace Information and Computing Service.
//
// The paraconsistent process kernel: processes settle to Knaster–Tarski fixed points,
// contradictions are held as ⊤ (stable) — never collapsed, never errors.
// Built on the MPU (processing) and MMU (memory); no boolean reductions.
//
// The process charge vocabulary:
//   potential — admitted, ready to advance
//   active    — denied
//   absurd    — unsettled, no mark yet
//   stable    — contradicted, held as data

// the admissibility chain

export {
  MEME_CHARGE,
  MEME_CHARGES,
  isMemeCharge,
  asMemeCharge,
  meetAdmissibility,
  foldCharges,
  isAdmitted,
  createMemeChargeCarrier,
} from "./charge.mjs";

// the process model

export {
  PROCESS_CARRIER_STATES,
  createProcess,
  processId,
  processPoint,
  idOfProcessPoint,
  judgmentState,
  nameOfJudgmentState,
  foldProcess,
  settleProcess,
  readProcessValue,
  processCarrier,
  processProjection,
  ProcessRuntime,
  processRuntime,
} from "./process.mjs";

// governance: structuration, regime selection, capability gate

export { readStructuration, selectRegime, admitUnder, capabilityGate } from "./governance.mjs";

// order relations and process placement

export { afterSet, successorSet, orderProcess, accessibleFrom } from "./allocation.mjs";
export { allocateProcess } from "@red-cup-engineering/computer/process-runtime/allocation";

// transition acts: dispatch, execute, derive state
export { PROCESS_FUNCTIONAL, dispatchProcess, executeProcess, deriveProcessState } from "./dispatch.mjs";

// ingress discipline: validate concurrent requests, drain through the single writer

export { defaultRequestValidator, createRequestQueue } from "./request-queue.mjs";

// the scheduler: kernel instants, run queues, syscall traps, advance passes, residue

export {
  KERNEL_INSTANT_KIND,
  SCHEDULED_PROCESS_KIND,
  SCHEDULE_DECISION_KIND,
  SYSCALL_TRAP_KIND,
  TIME_CARRIER_STATES,
  SCHEDULE_CARRIER_STATES,
  createKernelInstant,
  instantOf,
  compareInstants,
  instantPoint,
  KernelClock,
  timeCarrier,
  scheduleProcess,
  scheduleItemOf,
  schedulePoint,
  scheduleCarrier,
  scheduleDecision,
  scheduleProcesses,
  syscallTrap,
  settleProcesses,
  advanceProcesses,
  precipitateUnsettled,
  conserveEvidence,
} from "./scheduler.mjs";

// syscalls: admitted entries, name/number tables, trapped dispatch records

export {
  SYSCALL_ENTRY_KIND,
  SYSCALL_TABLE_KIND,
  SYSCALL_DISPATCH_KIND,
  SYSCALL_CARRIER_STATES,
  DISPATCH_CARRIER_STATES,
  syscallName,
  syscallNumber,
  syscallPoint,
  createSyscallEntry,
  settleSyscallEntry,
  isSyscallEntry,
  SyscallTable,
  createSyscallTable,
  syscallCarrier,
  dispatchSyscall,
  normalizeSyscallResult,
  dispatchPoint,
  dispatchCarrier,
} from "./syscall.mjs";

// boot image carriers

export {
  KERNEL_IMAGE_KIND,
  KERNEL_IMAGE_STATES,
  createKernelImage,
  kernelImagePoint,
  kernelImageCarrier,
  imageReadyCharge,
  bootImageProcess,
  kernelInterfaceProcess,
  settleKernelImage,
  kernelImageProjection,
  createKernelStore,
  bootKernel,
} from "./boot.mjs";
