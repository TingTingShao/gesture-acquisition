// Run with: node tests/protocol.cjs. No browser or dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let elapsed = 0;
const epoch = 1800000000000;
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [epoch + elapsed])); }
  static now() { return epoch + elapsed; }
}
const nodes = new Map();
function node() {
  const classes = new Set();
  return {
    value: '', checked: false, hidden: false, style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '',
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    addEventListener() {}, focus() {}, click() {}, remove() {}, setAttribute() {},
    appendChild(child) { this.children.push(child); },
    insertAdjacentHTML(where, content) { this.innerHTML += content; },
    querySelector() { return this.child || (this.child = node()); },
    querySelectorAll() { return []; }
  };
}
for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], node());
nodes.get('f-perform').value = '30';
nodes.get('f-session').value = '1';
const stored = new Map();
const body = node();
const window = {};
window.self = window.top = window;
const sandbox = {
  window, Date: Clock, Blob, TextEncoder, console,
  performance: { now: () => elapsed },
  localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  location: { protocol: 'file:', hostname: '', search: '' }, navigator: { userAgent: 'protocol-test' },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout() {},
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  document: { body, documentElement: {}, getElementById: id => nodes.get(id),
    querySelector: () => node(), querySelectorAll: () => [], createElement: node, addEventListener() {} }
};
let source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
source = source.replace(/\}\)\(\);\s*$/, `
globalThis.test = { S, SETS, BY_ID, WORKOUT,
  set: id => { CUR = id; applySet(); }, buildOrder, applyProtocol, scheduleEnd,
  startSession, update, togglePause, sessionMs, skipTrial, redoTrial, finishSession,
  csvText, jsonText, archiveCsv, resetToSetup, emailText,
  constants: () => ({ N, TRIAL, REST, LEAD, CYCLE, READY }) };
})();`);
vm.runInNewContext(source, sandbox, { filename: 'index.html' });
const app = sandbox.test;
const get = id => nodes.get(id);

// Randomness must never remove a requested class or change the time budget.
app.set('workout');
const distinct = new Set();
for (let run = 0; run < 1000; run++) {
  const order = app.buildOrder(10);
  assert.equal(order.length, 10);
  distinct.add(order.join(','));
  assert.equal(new Set(order).size, 4);
  assert.deepEqual(Array.from(new Set(app.WORKOUT.map(g => g.name))).sort(),
    ['Fast marching in place', 'Jumping jacks', 'Squats', 'Walking']);
  order.forEach(id => assert.ok(app.WORKOUT.some(g => g.id === id)));
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1]);
}
assert.ok(distinct.size > 900);

get('f-subject').value = 'S03';
app.startSession();
assert.equal(app.S.trials.length, 10);
assert.equal(app.S.rests.length, 10);
assert.equal(app.scheduleEnd(), 562000);
assert.equal(app.constants().LEAD, 0);
assert.equal(app.constants().REST, 48000);
assert.equal(app.constants().CYCLE, 60000);
assert.match(get('budget').innerHTML, /9:22/);
assert.equal(get('perform-row').hidden, true);
assert.match(get('rest-hint').textContent, /No rest activity is assigned/);
for (let i = 0; i < 10; i++) {
  const t = app.S.trials[i];
  const r = app.S.rests[i];
  const start = i === 0 ? 0 : 22000 + (i - 1) * 60000;
  const restDuration = i === 0 ? 10000 : 48000;
  assert.equal(t.plannedStart, start + restDuration);
  assert.equal(t.plannedEnd, start + restDuration + 12000);
  assert.equal(r.plannedStart, start);
  assert.equal(r.plannedEnd, t.plannedStart);
  assert.equal(r.label, 'Resting');
  assert.equal(r.category, 'Resting');
  assert.equal(r.activity, 'Resting');
  elapsed = start;
  app.update();
  assert.equal(get('ph-label').textContent, 'Resting');
  assert.equal(get('ph-count').textContent, restDuration / 1000);
  assert.match(get('hud-clock').textContent, /09:22$/);
  assert.match(get('ph-sub').textContent, /Rest however you like/);
  assert.doesNotMatch(get('ph-sub').textContent, /Stay still|no movement/);
  assert.equal(body.dataset.phase, 'rest');
  assert.equal(get('hud-trial').textContent, `Round ${i + 1} / 10`);
  assert.match(get('ph-sub').textContent, new RegExp(t.activity));
  elapsed = start + restDuration - 3000;
  app.update();
  assert.equal(get('ph-count').textContent, 3);
  assert.equal(get('ph-label').textContent, 'Resting · get ready');
  assert.equal(get('ph-title').textContent, t.activity);
  elapsed = start + restDuration - 1;
  app.update();
  assert.equal(get('ph-count').textContent, 1);
  elapsed = start + restDuration;
  app.update();
  assert.equal(get('ph-label').textContent, 'Workout');
  assert.equal(get('ph-title').textContent, t.activity);
  assert.equal(get('ph-count').textContent, 12);
  assert.equal(body.dataset.phase, 'perform');
  elapsed = start + restDuration + 12000 - 1;
  app.update();
  assert.equal(get('ph-count').textContent, 1);
}
elapsed = 562000;
app.update();
assert.equal(app.S.finished, true);
assert.ok(app.S.trials.every(t => t.status === 'completed'));
assert.ok(app.S.trials.every(t => t.actualEnd - t.actualStart === 12000));
assert.ok(app.S.rests.every((t, i) => t.status === 'completed' && t.actualEnd - t.actualStart === (i === 0 ? 10000 : 48000)));
const payload = JSON.parse(app.jsonText());
assert.equal(payload.protocol.total_s, 562);
assert.equal(payload.protocol.first_rest_s, 10);
assert.equal(payload.protocol.trial_s, 12);
assert.equal(payload.protocol.rest_s, 48);
assert.equal(payload.protocol.workout_windows, 10);
assert.equal(payload.protocol.resting_windows, 10);
assert.equal(payload.rests.filter(t => t.label === 'Resting').length, 10);
assert.equal(payload.events.filter(e => e.event === 'TRIAL_START').length, 10);
assert.equal(payload.events.filter(e => e.event === 'TRIAL_END').length, 10);
assert.equal(payload.events.filter(e => e.event === 'REST_START').length, 10);
assert.equal(payload.events.filter(e => e.event === 'REST_END').length, 10);
const csv = app.csvText().split('\n');
assert.equal(csv.length, 21);
assert.match(csv[0], /gesture_set,activity,category$/);
assert.equal(csv.filter(line => line.endsWith(',Resting,Resting')).length, 10);
assert.match(app.emailText(), /10 s resting \+ 12 s activity/);
assert.match(app.emailText(), /562 s total/);
assert.equal(app.archiveCsv().split('\n').length, 21);

// Legacy archived rows remain readable with the appended CSV columns.
stored.set('ga_archive_v1', JSON.stringify([{ payload: JSON.stringify({
  session: { subject_id: 'OLD', set: 'daily' }, trials: [{idx: 0, label: 'Drinking', plannedStart: 0, plannedEnd: 30000, status: 'not_reached'}]
}) }]));
assert.match(app.archiveCsv(), /Drinking,Gesture$/);

// Pause, skip, redo and early completion work for activity/rest rounds.
app.resetToSetup(); elapsed = 0; get('f-subject').value = 'S04'; app.startSession(); app.update();
elapsed = 3000; app.togglePause(); elapsed = 8000;
assert.equal(app.sessionMs(), 3000); app.togglePause();
assert.equal(app.sessionMs(), 3000);
app.skipTrial(); app.update();
assert.equal(app.S.trials[0].status, 'skipped');
assert.equal(get('ph-label').textContent, 'Resting');
app.redoTrial(); app.update();
assert.equal(app.S.trials[1].repeats, 1);
assert.equal(app.sessionMs(), 22000);
assert.equal(app.S.rests[1].status, 'pending');
app.finishSession();
assert.equal(app.S.trials[9].status, 'not_reached');
assert.equal(app.S.rests[9].status, 'not_reached');

// Skipping during rest skips this round and closes rest at the actual skip time.
app.resetToSetup(); elapsed = 0; get('f-subject').value = 'S05'; app.startSession(); app.update();
elapsed = 6000; app.skipTrial(); app.update();
assert.equal(app.S.trials[0].status, 'skipped');
assert.equal(app.S.rests[0].status, 'skipped');
assert.equal(app.S.rests[0].actualEnd - app.S.rests[0].actualStart, 6000);
app.finishSession();

// Skipping during activity preserves the preceding completed rest.
app.resetToSetup(); elapsed = 0; get('f-subject').value = 'S06'; app.startSession(); app.update();
elapsed = 10000; app.update(); elapsed = 12000; app.skipTrial(); app.update();
assert.equal(app.S.trials[0].status, 'skipped');
assert.equal(app.S.rests[0].status, 'completed');
assert.equal(app.S.rests[0].actualEnd - app.S.rests[0].actualStart, 10000);
app.finishSession();

// The two existing sets keep their original scheduling and coverage rules.
for (const id of ['daily', 'shapes']) {
  app.resetToSetup(); app.set(id);
  for (let run = 0; run < 100; run++) {
    const n = app.SETS[id].trials();
    app.applyProtocol(n, 30);
    assert.equal(app.scheduleEnd(), 600000);
    const order = app.buildOrder(n);
    assert.equal(order.length, n);
    assert.equal(new Set(order).size, id === 'daily' ? 8 : 4);
    if (id === 'daily') assert.equal(order.filter(x => x === 'drink').length, 2);
    else app.SETS[id].gestures.forEach(g => assert.ok(order.filter(x => x === g.id).length >= 2));
  }
  assert.equal(get('perform-row').hidden, id === 'shapes');
}
console.log('PASS: first rest 10 s, remaining nine 48 s; all ten activities 12 s; total 9:22; random coverage/no repeats; exports; pause/skip/redo; existing sets.');
