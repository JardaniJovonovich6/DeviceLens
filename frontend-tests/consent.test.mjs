import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/main/resources/static/app.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
function setup(fetchFn) {
  const elements = new Map();
  class Element {
    textContent = ''; disabled = false; className = ''; hidden = true;
    setAttribute() {} removeAttribute() {} replaceChildren() {} append() {}
    addEventListener(_, callback) { this.click = callback; }
  }
  const document = {querySelector: key => { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); }, createElement: () => new Element()};
  let detections = 0;
  const context = vm.createContext({document, detectDevice: async () => {detections++; return {model:'Unavailable'};},
    fieldLabels:{model:'Model'}, fetch:fetchFn, crypto:{randomUUID:()=> 'a791881a-f161-4b5a-8bfa-aa9e6a26a121'},
    AbortController, setTimeout, clearTimeout, TypeError, Error});
  vm.runInContext(source, context);
  return {elements, detections: () => detections};
}
test('detection on load makes no network calls before explicit click', async () => {
  let calls = 0; const ui = setup(() => {calls++;});
  await new Promise(resolve => setImmediate(resolve)); assert.equal(ui.detections(), 1); assert.equal(calls, 0);
  assert.match(ui.elements.get('#status').textContent, /Nothing has been shared/);
});
test('double click sends once and success waits for backend acknowledgement', async () => {
  let resolve; let calls = 0;
  const pending = new Promise(done => {resolve = done;});
  const ui = setup(async (_, options) => {calls++; assert.equal(JSON.parse(options.body).consent, true); return pending;});
  const button = ui.elements.get('#share-button');
  const first = button.click(); await Promise.resolve(); await button.click();
  assert.equal(calls, 1); assert.equal(button.disabled, true);
  assert.doesNotMatch(ui.elements.get('#status').textContent, /accepted by/);
  resolve({ok:true, json:async () => ({success:true,status:'accepted'})}); await first;
  assert.match(ui.elements.get('#status').textContent, /accepted by/);
  await button.click(); assert.equal(calls, 1);
});
test('network retry keeps submission ID for duplicate protection', async () => {
  const ids = []; const ui = setup(async (_, options) => {
    ids.push(JSON.parse(options.body).submissionId);
    if (ids.length === 1) throw new TypeError('network');
    return {ok:true,json:async () => ({success:true,status:'accepted'})};
  });
  const button = ui.elements.get('#share-button'); await button.click();
  assert.equal(button.disabled, false); assert.match(ui.elements.get('#status').textContent, /unknown/);
  await button.click(); assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
});
test('provider failure never displays success', async () => {
  const ui = setup(async () => ({ok:false,status:502,json:async () => ({errorCode:'EMAIL_UNCONFIRMED',detail:'Acceptance unknown.'})}));
  await ui.elements.get('#share-button').click();
  assert.equal(ui.elements.get('#status').className, 'status error');
  assert.equal(ui.elements.get('#share-button').disabled, true);
});
