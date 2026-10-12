// meme-store.ts — the Memetic Memory Unit. An in-memory store of Memes: it STORES (append, accretive,
// never overwrite) and READS (recall by address) — nothing more. It does NOT fold, settle, or otherwise
// process what it holds: a cell witnessed both ways stays as TWO memes here, and the processing unit
// folds them to ⊤ when it settles. It does NOT touch disk: persistence is a later, separate unit.
//
// Its only tie to the processing unit is the `Meme` DATA CLASS — a type. The import is type-only and
// erased at runtime, so the memory unit has no runtime dependency on anything.
import type { Meme } from "@561-group/meme";

/** A cell address: the identity half of a Meme (subject —predicate→ object). */
export type Address = Meme["cell"];

/** A deterministic structural key for an address, so equal cells recall together regardless of identity. */
function addressKey(cell: Address): string {
  const k = (x: unknown): string => (x === null || typeof x !== "object" ? typeof x + ":" + String(x) : JSON.stringify(x));
  return k(cell.subject) + "" + k(cell.predicate) + "" + k(cell.object);
}

export class MemeStore {
  #log: Meme[] = [];

  /** store(meme) — the WRITE: append a meme to memory. Accretive — never overwrites. Chainable. */
  store(meme: Meme): this {
    this.#log.push(meme);
    return this;
  }

  /** recall(address) — the READ: every meme stored at this exact cell address, in first-stored order.
   * Returns them RAW — memory does not fold; the processing unit settles them. Empty if none. */
  recall(address: Address): Meme[] {
    const key = addressKey(address);
    return this.#log.filter((m) => addressKey(m.cell) === key);
  }

  /** has(address) — whether any meme is stored at this address. */
  has(address: Address): boolean {
    const key = addressKey(address);
    return this.#log.some((m) => addressKey(m.cell) === key);
  }

  /** cells() — the distinct addresses present in memory, in first-stored order. */
  cells(): Address[] {
    const seen = new Set<string>();
    const out: Address[] = [];
    for (const m of this.#log) {
      const key = addressKey(m.cell);
      if (!seen.has(key)) { seen.add(key); out.push(m.cell); }
    }
    return out;
  }

  /** size — how many memes are stored. */
  get size(): number {
    return this.#log.length;
  }

  /** memes — a shallow copy of everything stored, in first-stored order. */
  get memes(): readonly Meme[] {
    return [...this.#log];
  }
}

export default MemeStore;
