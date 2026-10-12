/** Physical-host effect custody. This is an owning resource, not an agent lock.
 * The public wire executor receives data; only its protected owner receives this
 * transaction capability. Historical receipts are indexed by original effect ID,
 * never replayed or directory-walked on ordinary admission.
 */
import { DatabaseSync } from 'node:sqlite';
import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

const MAX_RECORD_BYTES = 262144;
const MAX_EFFECTS = 256;
const refusal = reason => Object.freeze({ kind: 'host-resource.refused', reason });
const data = value => {
  const text = JSON.stringify(value);
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_RECORD_BYTES)
    throw Error('host custody record exceeds its control resource');
  return JSON.parse(text);
};
const busy = error => error?.code === 'ERR_SQLITE_ERROR'
  && /database (?:is locked|is busy)/iu.test(error.message);

/** Verify every enclosing directory: a root-owned leaf inside a worker-writable
 * ancestor is replaceable and does not constitute protected custody. No symlinks.
 * Owner deployment creates the database before opening it; this API never seeds
 * privileged directories, changes permissions or grants worker authority.
 */
export function assertProtectedHostCustody(file) {
  if (process.getuid?.() !== 0 || !isAbsolute(file) || realpathSync(file) !== file)
    throw Error('protected host owner required');
  let current = file;
  for (;;) {
    const s = lstatSync(current);
    if (s.uid !== 0 || (s.mode & 0o022) || current === file && (s.mode & 0o077) || s.isSymbolicLink()
      || (current === file ? !s.isFile() || s.nlink !== 1 : !s.isDirectory()))
      throw Error('host custody is replaceable by another principal');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

/** Bind an already protected database and a host owner's reconciliation witness.
 * database is an owning capability (including :memory: for finite assays), never
 * a wire request field. Each transaction loads active/recent costs and one exact
 * record, up to 256 rows. A full bound refuses rather than scanning further.
 * Reconciliation must account for the physical host, including effects outside
 * this ledger; a guest boot ID or an empty database is not that evidence.
 */
export function createHostResourceCustody({ database, physicalHost,
  observeReconciliation, now = Date.now }) {
  if (!database || typeof physicalHost !== 'string' || !physicalHost
    || typeof observeReconciliation !== 'function') throw Error('owning custody capabilities required');
  // Reject another owner's database before changing journal or storage settings.
  const hasIdentity = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='host_identity'").get();
  if (hasIdentity && database.prepare('SELECT host FROM host_identity WHERE singleton=1').get()?.host !== physicalHost)
    throw Error('custody belongs to a different physical host');
  database.exec(`PRAGMA busy_timeout=0;
    PRAGMA journal_mode=DELETE;
    PRAGMA synchronous=FULL;
    PRAGMA max_page_count=4096;
    CREATE TABLE IF NOT EXISTS host_identity (singleton INTEGER PRIMARY KEY CHECK(singleton=1), host TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS effects (id TEXT PRIMARY KEY, status TEXT NOT NULL, received_at INTEGER, cost TEXT NOT NULL, record TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS effects_active ON effects(status) WHERE status != 'received';
    CREATE INDEX IF NOT EXISTS effects_recent ON effects(received_at) WHERE status = 'received';`);
  if (database.prepare('PRAGMA page_size').get().page_size > 4096
    || database.prepare('PRAGMA max_page_count').get().max_page_count > 4096)
    throw Error('host custody exceeds its reserved control storage');
  const identity = database.prepare('SELECT host FROM host_identity WHERE singleton=1').get();
  if (identity && identity.host !== physicalHost) throw Error('custody belongs to a different physical host');
  if (!identity) database.prepare('INSERT INTO host_identity(singleton,host) VALUES(1,?)').run(physicalHost);
  const find = database.prepare('SELECT record FROM effects WHERE id=?');
  // Separate indexed queries retain the IO debit without visiting old receipts.
  const active = database.prepare("SELECT id,status,received_at,cost FROM effects WHERE status != 'received' LIMIT ?");
  const recent = database.prepare("SELECT id,status,received_at,cost FROM effects INDEXED BY effects_recent WHERE status = 'received' AND received_at >= ? LIMIT ?");
  const uncertainDebit = database.prepare("SELECT id,status,received_at,cost FROM effects INDEXED BY effects_recent WHERE status = 'received' AND received_at IS NULL LIMIT ?");
  const upsert = database.prepare(`INSERT INTO effects(id,status,received_at,cost,record) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, received_at=excluded.received_at, cost=excluded.cost, record=excluded.record`);
  let closed = false;
  return Object.freeze({
    async transact(change, { id, ioWindowMs } = {}) {
      if (closed) return refusal('host-custody-closed');
      if (typeof change !== 'function' || typeof id !== 'string' || !id || id.length > 512
        || !Number.isSafeInteger(ioWindowMs) || ioWindowMs <= 0)
        return refusal('host-custody-context-required');
      const witness = await observeReconciliation();
      if (witness?.physicalHost !== physicalHost || witness.accepted !== true
        || witness.against === true || typeof witness.receipt !== 'string' || !witness.receipt)
        return refusal('host-effects-not-reconciled');
      let begun = false;
      try {
        database.exec('BEGIN IMMEDIATE'); begun = true;
        const rows = active.all(MAX_EFFECTS + 1);
        if (rows.length > MAX_EFFECTS) { database.exec('ROLLBACK'); begun = false; return refusal('host-custody-observation-full'); }
        const debit = uncertainDebit.all(MAX_EFFECTS - rows.length + 1);
        if (rows.length + debit.length <= MAX_EFFECTS)
          debit.push(...recent.all(now() - ioWindowMs, MAX_EFFECTS - rows.length - debit.length + 1));
        if (rows.length + debit.length > MAX_EFFECTS) { database.exec('ROLLBACK'); begun = false; return refusal('host-custody-observation-full'); }
        const effects = Object.create(null);
        for (const row of [...rows, ...debit]) {
          const cost = Object.freeze(JSON.parse(row.cost));
          Object.defineProperty(effects, row.id, { enumerable: true, value: Object.freeze({
            status: row.status, cost, ...(row.received_at === null ? {} : { receivedAt: row.received_at }) }) });
        }
        const original = find.get(id);
        // Only the requested original is mutable. Other effects are debit facts,
        // not callbacks' authority to release someone else's resource custody.
        const stateEffects = Object.assign(Object.create(null), effects);
        for (const other of Object.keys(effects)) if (other !== id)
          Object.defineProperty(stateEffects, other, { writable: false, configurable: false });
        if (original) stateEffects[id] = data(JSON.parse(original.record));
        else delete stateEffects[id];
        const state = { physicalHost, reconciled: true, effects: stateEffects };
        const result = change(state);
        if (result?.then || state.effects !== stateEffects || state.physicalHost !== physicalHost
          || state.reconciled !== true || Object.keys(stateEffects).some(key => key !== id && !Object.hasOwn(effects, key)))
          throw Error('host transaction cannot expand its original effect scope');
        if (original && !Object.hasOwn(stateEffects, id)) throw Error('custody cannot forget an original effect');
        if (Object.hasOwn(stateEffects, id)) {
          const record = data(stateEffects[id]);
          if (!['reserved','executing','uncertain','received'].includes(record.status)
            || record.request?.id !== id || !record.cost
            || record.status === 'received' && (!Number.isSafeInteger(record.receivedAt) || record.receipt?.terminated !== true || record.receipt?.id !== id))
            throw Error('invalid host effect transition');
          if (original) {
            const before = JSON.parse(original.record);
            if (JSON.stringify(before.request) !== JSON.stringify(record.request)
              || JSON.stringify(before.cost) !== JSON.stringify(record.cost)
              || before.status === 'received' && JSON.stringify(before) !== JSON.stringify(record))
              throw Error('immutable original effect or receiving changed');
          }
          const encoded = JSON.stringify(record);
          if (!original || encoded !== original.record)
            upsert.run(id, record.status, record.receivedAt ?? null, JSON.stringify(record.cost), encoded);
        }
        database.exec('COMMIT'); begun = false;
        return result;
      } catch (error) {
        if (begun) database.exec('ROLLBACK');
        if (busy(error)) return refusal('host-custody-busy');
        throw error;
      }
    },
    close() { if (!closed) { closed = true; database.close(); } },
  });
}

export function openProtectedHostResourceCustody({ file, ...options }) {
  assertProtectedHostCustody(file);
  // No caller-selected location or fallback. SQLite's bounded journal lives with
  // the protected database and is part of the owner's reserved control resource.
  const database = new DatabaseSync(file);
  try { return createHostResourceCustody({ ...options, database }); }
  catch (error) { database.close(); throw error; }
}
