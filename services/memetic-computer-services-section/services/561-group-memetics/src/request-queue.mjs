// request-queue.ts — single-writer intent queues for trace-writing loops.
//
// Network handlers and other concurrent ingress points validate raw input into
// intents, then enqueue them. The process loop is the only writer: it drains the
// queue in arrival order and appends any resulting trace rows itself.

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export const defaultRequestValidator = (raw) =>
  isPlainObject(raw) ? raw : null;

export function createRequestQueue(
  validate = defaultRequestValidator,
) {
  if (typeof validate !== "function") throw new TypeError("createRequestQueue: validate must be a function");

  let pending = [];

  return Object.freeze({
    push(raw) {
      const intent = validate(raw) ?? null;
      if (intent !== null) pending.push(intent);
      return intent;
    },

    drain() {
      const out = pending;
      pending = [];
      return out;
    },

    peek() {
      return pending.slice();
    },

    depth() {
      return pending.length;
    },
  });
}

export default createRequestQueue;
