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
export type { MemeCharge, MemeChargeCarrier } from "./charge.ts";
export {
  MEME_CHARGE,
  MEME_CHARGES,
  isMemeCharge,
  asMemeCharge,
  meetAdmissibility,
  foldCharges,
  isAdmitted,
  createMemeChargeCarrier,
} from "./charge.ts";

// the process model
export type {
  Row,
  Judgment,
  Judge,
  Process,
  Section,
  ReadinessClaim,
  ProcessReadinessCone,
  ProcessResidue,
  FoldedProcess,
  SettledProcess,
  ProcessCarrierState,
} from "./process.ts";
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
} from "./process.ts";

// governance: structuration, regime selection, capability gate
export type { Structuration, RegimeDecision, Regime } from "./governance.ts";
export { readStructuration, selectRegime, admitUnder, capabilityGate } from "./governance.ts";

// order relations and process placement
export type { Allocation, ProcessOrderFace } from "./allocation.ts";
export { afterSet, successorSet, orderProcess, accessibleFrom, allocateProcess } from "./allocation.ts";

// transition acts: dispatch, execute, derive state
export { PROCESS_FUNCTIONAL, dispatchProcess, executeProcess, deriveProcessState } from "./dispatch.ts";

// ingress discipline: validate concurrent requests, drain through the single writer
export type { RequestValidator, RequestQueue } from "./request-queue.ts";
export { defaultRequestValidator, createRequestQueue } from "./request-queue.ts";

// the scheduler: kernel instants, run queues, syscall traps, advance passes, residue
export type {
  KernelInstant,
  TimeCarrierState,
  ScheduledProcess,
  ScheduleCarrierState,
  ScheduleDecision,
  RunQueue,
  SyscallTrap,
  AdvanceResult,
  PrecipitateResult,
} from "./scheduler.ts";
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
} from "./scheduler.ts";

// syscalls: admitted entries, name/number tables, trapped dispatch records
export type {
  SyscallJudgment,
  SyscallHandlerInput,
  SyscallResult,
  SyscallEntry,
  SettledSyscallEntry,
  SyscallReport,
  NormalizedSyscallResult,
  SyscallDispatch,
  SyscallCarrierState,
  DispatchCarrierState,
} from "./syscall.ts";
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
} from "./syscall.ts";

// boot image carriers
export type {
  BootComponent,
  KernelInterface,
  KernelInterfaceInput,
  KernelImage,
  KernelImageState,
  KernelImageInput,
  BootedKernel,
  KernelImageProjection,
} from "./boot.ts";
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
} from "./boot.ts";
