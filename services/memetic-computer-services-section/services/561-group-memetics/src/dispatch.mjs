// dispatch.ts — process TRANSITION acts.
//
// A dispatch or execution is a NEW row appended to the process trace — never a mutated status
// field. The current state is always the fold of the whole trace (latest-t wins for
// single-valued predicates). Evidence is linear: nothing is dropped.

import { processId } from "./process.mjs";

// ── functional predicates ─────────────────────────────────────────────────────────────────────

/** Single-valued (functional) process predicates: latest-t wins at fold. */
export const PROCESS_FUNCTIONAL = Object.freeze(
  new Set(["dispatched-to", "execution-state", "allocated-at", "principal"]),
);

// ── transition acts ───────────────────────────────────────────────────────────────────────────

/** Dispatch a process to an office. Appends (dispatched-to) and (dispatched-by) rows. */
export function dispatchProcess(
  proc,
  office,
  dispatcher,
  opts,
) {
  const e = processId(proc);
  if (!e) throw new TypeError("dispatchProcess: process must have a string id");
  const t = explicitStamp(opts, "dispatchProcess");
  const officeName = nameOf(office);
  const dispatcherName = nameOf(dispatcher);
  const rows = [
    { e, a: "dispatched-to", v: officeName, t },
    { e, a: "dispatched-by", v: dispatcherName, t },
  ];
  return Object.freeze({
    ...proc,
    rows: [...proc.rows, ...rows],
    dispatch: Object.freeze({ kind: "process.dispatch", office: officeName, dispatcher: dispatcherName, t, rows }),
  });
}

/** Record an executor advancing the process to a state. Appends (execution-state) and (executed-by) rows. */
export function executeProcess(
  proc,
  executor,
  state,
  opts,
) {
  const e = processId(proc);
  if (!e) throw new TypeError("executeProcess: process must have a string id");
  const t = explicitStamp(opts, "executeProcess");
  const executorName = nameOf(executor);
  const rows = [
    { e, a: "execution-state", v: state, t },
    { e, a: "executed-by", v: executorName, t },
  ];
  return Object.freeze({
    ...proc,
    rows: [...proc.rows, ...rows],
    execution: Object.freeze({ kind: "process.execution", executor: executorName, state, t, rows }),
  });
}

/** Fold the process trace to its current transition state. Latest-t wins for functional predicates. */
export function deriveProcessState(proc)

 {
  const rows = proc.rows;
  const latest = {};
  const history = [];
  for (const r of rows) {
    if (r.a === "execution-state") history.push({ state: String(r.v), t: r.t });
    if (PROCESS_FUNCTIONAL.has(String(r.a))) {
      const cur = latest[String(r.a)];
      if (cur === undefined || String(r.t) > String(cur.t)) latest[String(r.a)] = { v: r.v, t: r.t };
    }
  }
  history.sort((a, b) => String(a.t).localeCompare(String(b.t)));
  return Object.freeze({
    id: processId(proc),
    dispatchedTo: String(latest["dispatched-to"]?.v ?? ""),
    executionState: String(latest["execution-state"]?.v ?? ""),
    allocatedAt: String(latest["allocated-at"]?.v ?? ""),
    principal: String(latest["principal"]?.v ?? ""),
    history: Object.freeze(history),
  });
}

function nameOf(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  const o = x;
  return String(o["name"] ?? o["office"] ?? o["id"] ?? x);
}

function explicitStamp(opts, source) {
  const stamp = opts?.t ?? opts?.now ?? opts?.at;
  if (stamp === undefined || stamp === null) {
    throw new TypeError(`${source}: explicit transition stamp required`);
  }
  if (typeof stamp === "string") return stamp;
  if (typeof stamp === "number") return String(stamp);
  if (stamp instanceof Date) return stamp.toISOString();
  return String(stamp.label ?? stamp.tick ?? stamp.ordinal ?? stamp);
}
