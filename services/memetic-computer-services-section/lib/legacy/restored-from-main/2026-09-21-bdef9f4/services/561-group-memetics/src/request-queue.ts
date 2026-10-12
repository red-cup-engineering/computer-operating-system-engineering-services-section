// request-queue.ts — single-writer intent queues for trace-writing loops.
//
// Network handlers and other concurrent ingress points validate raw input into
// intents, then enqueue them. The process loop is the only writer: it drains the
// queue in arrival order and appends any resulting trace rows itself.

export type RequestValidator<Raw = unknown, Intent extends object = Record<string, unknown>> =
  (raw: Raw) => Intent | null | undefined;

export type RequestQueue<Raw = unknown, Intent extends object = Record<string, unknown>> = Readonly<{
  push(raw: Raw): Intent | null;
  drain(): Intent[];
  peek(): Intent[];
  depth(): number;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export const defaultRequestValidator: RequestValidator<unknown, Record<string, unknown>> = (raw) =>
  isPlainObject(raw) ? raw : null;

export function createRequestQueue<Raw = unknown, Intent extends object = Record<string, unknown>>(
  validate: RequestValidator<Raw, Intent> = defaultRequestValidator as RequestValidator<Raw, Intent>,
): RequestQueue<Raw, Intent> {
  if (typeof validate !== "function") throw new TypeError("createRequestQueue: validate must be a function");

  let pending: Intent[] = [];

  return Object.freeze({
    push(raw: Raw): Intent | null {
      const intent = validate(raw) ?? null;
      if (intent !== null) pending.push(intent);
      return intent;
    },

    drain(): Intent[] {
      const out = pending;
      pending = [];
      return out;
    },

    peek(): Intent[] {
      return pending.slice();
    },

    depth(): number {
      return pending.length;
    },
  });
}

export default createRequestQueue;
