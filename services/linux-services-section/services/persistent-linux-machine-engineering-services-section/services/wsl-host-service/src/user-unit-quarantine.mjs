// Durable boot/reentry custody for one record-owned user unit. No stop/start/thaw.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, realpathSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const hash = b => createHash('sha256').update(b).digest('hex');
const fail = message => { throw new Error('quarantine refused: ' + message); };
const read = (p, max = 65536) => { const b = readFileSync(p); if (b.length > max) fail('oversized ' + p); return b.toString('utf8'); };
const same = (a, b, label) => { if (!isDeepStrictEqual(a, b)) fail(label + ' changed'); };
const pathData = p => typeof p === 'string' && /^\/[A-Za-z0-9_./+@=-]+$/.test(p) && !p.split('/').includes('..');
export function quarantineDeclaration(parameters) {
  const q = parameters.linux?.userUnitQuarantine;
  if (!q) fail('no declared quarantine; omission does not release an existing native hold');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(q.id) || !/^[a-zA-Z0-9_.@-]+\.service$/.test(q.unit) || !Number.isSafeInteger(q.uid) || q.uid < 1 || !pathData(q.home) || !q.origin) fail('invalid owner binding');
  const area = join(q.home, '.local/state/wsl-host-service/quarantines');
  const marker = join(area, q.id + '.json');
  const guard = join(q.home, '.config/systemd/user', q.unit + '.d', '90-wsl-host-quarantine-' + q.id + '.conf');
  return { ...q, area, marker, guard, released: join(area, q.id + '.released.json'),
    guardText: '# Owned by the WSL host record. Ordinary apply never clears this hold.\n[Unit]\nConditionPathExists=!' + marker + '\n' };
}
export function nativeQuarantinePort({ budgetMs = 15000 } = {}) {
  if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 60000) fail('finite native allocation required');
  const deadline = performance.now() + budgetMs;
  const runNative = (executable, args) => {
    const timeout = Math.floor(deadline - performance.now());
    if (timeout < 1) fail('native allocation exhausted');
    return execFileSync(executable, args, { encoding: 'utf8', timeout, maxBuffer: 65536 });
  };
  const run = args => runNative('/usr/bin/systemctl', ['--user', ...args]);
  return {
    uid: () => process.getuid(),
    reload: () => run(['daemon-reload']),
    unit: unit => {
      const output = run(['show', unit, '--no-pager', '--property=Id,MainPID,ControlPID,InvocationID,ControlGroup,ActiveState,SubState,FreezerState,Job,DropInPaths,ExecStart']);
      const result = Object.fromEntries(output.trim().split('\n').filter(Boolean).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
      const escaped = [...unit].map(c => /[A-Za-z0-9]/.test(c) ? c : '_' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      const conditions = JSON.parse(runNative('/usr/bin/busctl', ['--user', '--json=short', 'get-property', 'org.freedesktop.systemd1', '/org/freedesktop/systemd1/unit/' + escaped, 'org.freedesktop.systemd1.Unit', 'Conditions']));
      if (conditions.type !== 'a(sbbsi)' || !Array.isArray(conditions.data)) fail('unqualified native condition schema');
      result.conditions = conditions.data;
      return result;
    },
    process: pid => {
      const stat = read('/proc/' + pid + '/stat');
      const tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      return { pid, startTime: tail[19], argv: read('/proc/' + pid + '/cmdline').split('\0').filter(Boolean),
        cwd: realpathSync('/proc/' + pid + '/cwd'), cgroup: read('/proc/' + pid + '/cgroup').trim() };
    },
    boot: () => read('/proc/sys/kernel/random/boot_id').trim(),
    cohortTerminal: group => {
      if (!/^\/[A-Za-z0-9_./@:-]+$/.test(group) || group.includes('..')) fail('invalid captured cgroup');
      const path = '/sys/fs/cgroup' + group + '/cgroup.events';
      try { return /^populated 0$/m.test(read(path)); } catch (e) { if (e.code === 'ENOENT') return true; throw e; }
    }
  };
}
function ownedPath(p, q, { create = false, privateFile = false } = {}) {
  if (!p.startsWith(q.home + '/') && p !== q.home) fail('path outside declared home');
  const parts = [q.home, ...p.slice(q.home.length + 1).split('/').filter(Boolean)];
  let current = parts.shift();
  for (const part of [null, ...parts]) {
    if (part) current = join(current, part);
    if (create && !existsSync(current)) mkdirSync(current, { mode: 0o700 });
    const st = lstatSync(current);
    if (st.isSymbolicLink() || st.uid !== q.uid || (st.mode & 0o022)) fail('unsafe owner path ' + current);
    if (current !== p && !st.isDirectory()) fail('non-directory owner path');
    if (privateFile && current === p && (!st.isFile() || (st.mode & 0o077))) fail('non-private custody file');
  }
}
function syncDir(p) { const fd = openSync(p, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function exclusive(p, text, q) {
  ownedPath(dirname(p), q, { create: true });
  const fd = openSync(p, 'wx', 0o600);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  syncDir(dirname(p));
}
function capture(q, native) {
  same(native.uid(), q.uid, 'executing owner');
  const u = native.unit(q.unit);
  same(u.Id, q.unit, 'unit');
  if (u.ControlPID !== '0' || (u.Job && u.Job !== '0')) fail('control operation or queued job');
  same(u.MainPID, String(q.expected.pid), 'main PID');
  same(u.InvocationID, q.expected.invocationId, 'invocation');
  same(u.ControlGroup, q.expected.controlGroup, 'control group');
  same([u.ActiveState, u.SubState, u.FreezerState], ['active', 'running', 'frozen'], 'frozen resident');
  same(native.boot(), q.expected.bootId, 'boot');
  same(native.process(q.expected.pid), q.expected.process, 'process identity');
  return { bootId: q.expected.bootId, pid: q.expected.pid, invocationId: u.InvocationID, controlGroup: u.ControlGroup, process: q.expected.process };
}
function readMarker(q) {
  ownedPath(q.marker, q, { privateFile: true });
  const text = read(q.marker);
  const marker = JSON.parse(text);
  if (marker.type !== 'WslUserUnitQuarantine' || marker.version !== 1) fail('unknown hold format');
  same([marker.id, marker.unit, marker.uid, marker.home], [q.id, q.unit, q.uid, q.home], 'hold owner');
  return { marker, text, digest: hash(text) };
}
function guardLoaded(q, native) {
  ownedPath(q.guard, q, { privateFile: true });
  same(read(q.guard), q.guardText, 'native guard bytes');
  const unit = native.unit(q.unit);
  if (!(unit.DropInPaths || '').split(' ').includes(q.guard)) fail('guard not loaded by user manager');
  if (!unit.conditions?.some(row => row[0] === 'ConditionPathExists' && row[1] === false && row[2] === true && row[3] === q.marker)) fail('effective negative marker condition missing');
}
export function planQuarantine(parameters, native = nativeQuarantinePort()) {
  const q = quarantineDeclaration(parameters);
  same(native.uid(), q.uid, 'executing owner');
  if (!existsSync(q.marker)) return { type: 'WslUserUnitQuarantinePlan', status: 'unheld', unit: q.unit, marker: q.marker };
  const held = readMarker(q); guardLoaded(q, native);
  return { type: 'WslUserUnitQuarantinePlan', status: 'held', unit: q.unit, marker: q.marker, markerSha256: held.digest, original: held.marker.original };
}
export function holdQuarantine(parameters, native = nativeQuarantinePort()) {
  const q = quarantineDeclaration(parameters);
  if (existsSync(q.released)) fail('released identity cannot be reused for a new hold');
  if (existsSync(q.marker)) {
    const held = readMarker(q);
    same(held.marker.original, capture(q, native), 'held invocation');
    guardLoaded(q, native);
    return { status: 'held', markerSha256: held.digest, unchanged: true };
  }
  const original = capture(q, native);
  const marker = { type: 'WslUserUnitQuarantine', version: 1, id: q.id, unit: q.unit, uid: q.uid, home: q.home, origin: q.origin, original, heldAt: new Date().toISOString() };
  // Marker first: a partial operation never clears custody. A marker without its
  // loaded guard is explicitly NOT received as a boot-safe hold.
  exclusive(q.marker, JSON.stringify(marker) + '\n', q);
  if (existsSync(q.guard)) { ownedPath(q.guard, q, { privateFile: true }); same(read(q.guard), q.guardText, 'existing guard'); }
  else exclusive(q.guard, q.guardText, q);
  capture(q, native);
  native.reload();
  capture(q, native); guardLoaded(q, native);
  return { status: 'held', markerSha256: readMarker(q).digest, unchanged: false };
}
export function releaseQuarantine(parameters, native = nativeQuarantinePort()) {
  const q = quarantineDeclaration(parameters);
  same(native.uid(), q.uid, 'executing owner');
  const held = readMarker(q); guardLoaded(q, native);
  const binding = q.replacementReceiving;
  if (!binding || !pathData(binding.path) || !/^[a-f0-9]{64}$/.test(binding.sha256 || '')) fail('no source-owned independently received replacement Resource');
  ownedPath(binding.path, q, { privateFile: true });
  const text = read(binding.path);
  same(hash(text), binding.sha256, 'receiving Resource digest');
  const r = JSON.parse(text);
  if (r.type !== 'WslQuarantineReplacementReceiving' || r.version !== 1 || !r.receiver || !r.subject || r.unknownEffectsReconciled !== true || !Array.isArray(r.unresolvedEffects) || r.unresolvedEffects.length) fail('replacement receiving incomplete');
  same([r.id, r.unit, r.markerSha256, r.oldInvocationId], [q.id, q.unit, held.digest, held.marker.original.invocationId], 'receiving subject');
  const p = q.replacement;
  if (!p || !pathData(p.profile) || !/^[a-f0-9]{40}$/.test(p.gitHead || '') || !/^[a-f0-9]{40}$/.test(p.selectorGitBlob || '')) fail('invalid replacement binding');
  same(r.profile, p.profile, 'profile');
  if (!pathData(r.artifactRoot) || !/^\/gnu\/store\/[a-z0-9]{32}-[^/]+$/.test(r.artifactRoot) || !/^[a-f0-9]{64}$/.test(r.profileRecordSha256 || '')) fail('invalid received product');
  same(hash(read(p.profile + '.lagoon-release.json', 1048576)), r.profileRecordSha256, 'native profile record');
  same(readlinkSync(p.profile), r.profileLink, 'native profile link');
  same(dirname(realpathSync(join(p.profile, 'package.json'))), r.artifactRoot, 'native artifact');
  const packageRoot = dirname(realpathSync(join(p.profile, 'node_modules', '@red-cup-engineering/computer-deployment-engine/package.json')));
  const manifest = JSON.parse(read(join(packageRoot, 'package.json')));
  same([manifest.name, manifest.version, manifest.gitHead], ['@red-cup-engineering/computer-deployment-engine', p.version, p.gitHead], 'qualified controller');
  const script = readFileSync(join(packageRoot, 'scripts/release-on-landing.mjs'));
  const blob = createHash('sha1').update(Buffer.from('blob ' + script.length + '\0')).update(script).digest('hex');
  same(blob, p.selectorGitBlob, 'qualified selector source');
  const unit = native.unit(q.unit);
  if (unit.MainPID !== '0' || unit.ControlPID !== '0' || (unit.Job && unit.Job !== '0') || !['inactive', 'failed'].includes(unit.ActiveState)) fail('replacement unit not held terminal');
  const argv = /(?:^|;\s*)argv\[\]=([^;]+)\s*;/.exec(unit.ExecStart || '')?.[1]?.trim().split(/\s+/);
  same(argv, r.execStart, 'selected native command');
  if (!Array.isArray(argv) || argv.length !== 2 || argv[0] !== join(r.artifactRoot, 'bin/node') || argv[1] !== join(r.artifactRoot, 'node_modules/@red-cup-engineering/computer-deployment-engine/scripts/release-on-landing.mjs')) fail('command outside received product');
  if (!native.cohortTerminal(held.marker.original.controlGroup)) fail('old hierarchical cohort remains populated');
  const cdeHolds = p.profile + '.lagoon-unit-holds';
  if (existsSync(cdeHolds) && readdirSync(cdeHolds).length) fail('unresolved native controller hold');
  // No stop/start, replay, cursor rewrite or effect reconciliation occurs here.
  // The approved Resource digest carries the independent receiving decision.
  const released = { type: 'WslUserUnitQuarantineReleased', version: 1, id: q.id, marker: held.marker, markerSha256: held.digest, receivingSha256: binding.sha256, profileRecordSha256: r.profileRecordSha256, releasedAt: new Date().toISOString() };
  if (existsSync(q.released)) fail('release outcome already exists; reconcile original outcome');
  exclusive(q.released, JSON.stringify(released) + '\n', q);
  same(readMarker(q).digest, held.digest, 'hold before release');
  guardLoaded(q, native);
  unlinkSync(q.marker); syncDir(q.area);
  return { status: 'released', receivingSha256: binding.sha256, started: false };
}
