import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { holdQuarantine, planQuarantine, quarantineDeclaration, releaseQuarantine } from '../src/user-unit-quarantine.mjs';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'wsl-quarantine-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const expected = { pid: 101, invocationId: 'a'.repeat(32), controlGroup: '/user.slice/test.service', bootId: 'old-boot',
    process: { pid: 101, startTime: '1234', argv: ['/gnu/store/node/bin/node', '/gnu/store/old/selector.mjs'], cwd: '/gnu/store/old', cgroup: '0::/user.slice/test.service' } };
  const parameters = { linux: { userUnitQuarantine: { id: 'old-selector', unit: 'selector.service', uid: process.getuid(), home,
    origin: 'https://github.com/example/owner/issues/48', expected, replacementReceiving: null } } };
  const q = quarantineDeclaration(parameters);
  const u = { Id: q.unit, MainPID: '101', ControlPID: '0', InvocationID: expected.invocationId, ControlGroup: expected.controlGroup,
    ActiveState: 'active', SubState: 'running', FreezerState: 'frozen', Job: '', DropInPaths: '', conditions: [] };
  const effects = [];
  const native = { uid: () => process.getuid(), unit: () => ({ ...u }), boot: () => expected.bootId,
    process: () => structuredClone(expected.process), reload: () => { effects.push('daemon-reload'); u.DropInPaths = q.guard; u.conditions = [['ConditionPathExists', false, true, q.marker, 0]]; },
    cohortTerminal: () => true };
  return { parameters, q, native, u, effects, expected };
}

test('hold preserves the exact frozen resident and loads only a durable condition', t => {
  const f = fixture(t);
  assert.equal(holdQuarantine(f.parameters, f.native).status, 'held');
  assert.deepEqual(f.effects, ['daemon-reload']);
  assert.equal(f.u.MainPID, '101');
  assert.equal(f.u.FreezerState, 'frozen');
  assert.equal(readFileSync(f.q.guard, 'utf8'), f.q.guardText);
  assert.equal(planQuarantine(f.parameters, f.native).status, 'held');
  assert.equal(holdQuarantine(f.parameters, f.native).unchanged, true);
  assert.deepEqual(f.effects, ['daemon-reload']);
});

test('identity drift, wrong owner and control jobs refuse before writing', t => {
  for (const change of [
    f => { f.u.InvocationID = 'b'.repeat(32); },
    f => { f.u.Job = '17'; },
    f => { f.u.ControlPID = '22'; },
    f => { f.u.FreezerState = 'running'; },
    f => { f.native.uid = () => 999999; },
    f => { f.native.process = () => ({ ...f.expected.process, startTime: 'other' }); }
  ]) {
    const f = fixture(t); change(f);
    assert.throws(() => holdQuarantine(f.parameters, f.native), /refused/);
    assert.equal(existsSync(f.q.marker), false);
    assert.deepEqual(f.effects, []);
  }
});

test('a failed reload leaves original marker and guard, and refuses a false received result', t => {
  const f = fixture(t);
  f.native.reload = () => { throw new Error('native reload uncertain'); };
  assert.throws(() => holdQuarantine(f.parameters, f.native), /uncertain/);
  assert.equal(existsSync(f.q.marker), true);
  assert.equal(existsSync(f.q.guard), true);
  assert.throws(() => planQuarantine(f.parameters, f.native), /not loaded/);
  assert.throws(() => holdQuarantine(f.parameters, f.native), /not loaded/);
});

test('changed resident after native reload leaves the persistent hold', t => {
  const f = fixture(t);
  const reload = f.native.reload;
  f.native.reload = () => { reload(); f.u.InvocationID = 'b'.repeat(32); };
  assert.throws(() => holdQuarantine(f.parameters, f.native), /invocation changed/);
  assert.ok(existsSync(f.q.marker));
  assert.ok(existsSync(f.q.guard));
});

test('omission, renamed declaration and simulated boot cannot clear existing custody', t => {
  const f = fixture(t);
  holdQuarantine(f.parameters, f.native);
  const bytes = readFileSync(f.q.marker, 'utf8');
  assert.throws(() => releaseQuarantine({ linux: {} }, f.native), /omission does not release/);
  const renamed = structuredClone(f.parameters);
  renamed.linux.userUnitQuarantine.id = 'different-name';
  assert.throws(() => releaseQuarantine(renamed, f.native), /ENOENT/);
  f.u.MainPID = '0'; f.u.ActiveState = 'inactive'; f.u.SubState = 'dead'; f.native.boot = () => 'new-boot';
  assert.throws(() => releaseQuarantine(f.parameters, f.native), /independently received/);
  assert.equal(readFileSync(f.q.marker, 'utf8'), bytes);
  assert.equal(planQuarantine(f.parameters, f.native).status, 'held');
});

test('a fabricated receiving file cannot bypass the reviewed digest or original hold subject', t => {
  const f = fixture(t);
  holdQuarantine(f.parameters, f.native);
  const path = join(f.q.area, 'replacement.json');
  writeFileSync(path, '{}\n', { mode: 0o600 });
  f.parameters.linux.userUnitQuarantine.replacementReceiving = { path, sha256: '0'.repeat(64) };
  assert.throws(() => releaseQuarantine(f.parameters, f.native), /digest changed/);
  assert.ok(existsSync(f.q.marker));
  assert.deepEqual(f.effects, ['daemon-reload']);
});

test('foreign or symlinked custody paths refuse', t => {
  const f = fixture(t);
  mkdirSync(join(f.q.home, '.local'));
  symlinkSync('/tmp', join(f.q.home, '.local/state'));
  assert.throws(() => holdQuarantine(f.parameters, f.native), /unsafe owner path/);
  assert.equal(existsSync(f.q.guard), false);
});

test('tampered native condition never qualifies as held', t => {
  const f = fixture(t);
  holdQuarantine(f.parameters, f.native);
  writeFileSync(f.q.guard, '[Unit]\n');
  assert.throws(() => planQuarantine(f.parameters, f.native), /guard bytes changed/);
});

test('private file mode and prior release outcomes are authoritative', t => {
  const f = fixture(t);
  holdQuarantine(f.parameters, f.native);
  chmodSync(f.q.marker, 0o644);
  assert.throws(() => planQuarantine(f.parameters, f.native), /non-private custody/);
  chmodSync(f.q.marker, 0o600);
  writeFileSync(f.q.released, '{}', { mode: 0o600 });
  assert.throws(() => holdQuarantine(f.parameters, f.native), /reconcile|cannot be reused/);
});

test('a later native condition reset refuses despite retained drop-in bytes', t => {
  const f = fixture(t);
  holdQuarantine(f.parameters, f.native);
  f.u.conditions = [];
  assert.throws(() => planQuarantine(f.parameters, f.native), /effective negative marker condition missing/);
  assert.ok(existsSync(f.q.marker));
});

test('the actual service CLI reports an unheld declaration as drift and refuses staged hold effects', t => {
  const f = fixture(t);
  const record = join(f.q.home, 'wsl-host.json');
  writeFileSync(record, JSON.stringify(f.parameters), { mode: 0o600 });
  const cli = fileURLToPath(new URL('../scripts/wsl-host.mjs', import.meta.url));
  const plan = spawnSync(process.execPath, [cli, 'quarantine-plan', '--parameters=' + record], { encoding: 'utf8', timeout: 5000 });
  assert.equal(plan.status, 2, plan.stderr);
  assert.equal(JSON.parse(plan.stdout).status, 'unheld');
  const staged = spawnSync(process.execPath, [cli, 'quarantine-hold', '--parameters=' + record, '--root=' + f.q.home], { encoding: 'utf8', timeout: 5000 });
  assert.equal(staged.status, 2, staged.stderr);
  assert.match(staged.stderr, /not staged/);
  assert.equal(existsSync(f.q.marker), false);
});
