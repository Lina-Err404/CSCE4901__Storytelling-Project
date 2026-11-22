import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

// Exercise the actual component with controlled hooks, time, and requests.
// This checks behavior without installing a DOM or test framework.
const source = fs.readFileSync(new URL('../components/grammar/GrammarSuggestions.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
} }).outputText;

function harness(initialText = 'She walk home.') {
  const slots = [], timers = new Map(), requests = [], changes = [];
  let cursor = 0, effect, cleanup, dependencies, now = 0, timerId = 0;
  let props = { text: initialText, onTextChange: value => changes.push(value) };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(callback, deps) {
      if (!dependencies || deps.some((value, index) => value !== dependencies[index])) {
        dependencies = deps;
        effect = callback;
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: name => name === 'react' ? hooks : jsx,
    AbortController,
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  let tree;
  function render(text = props.text) {
    props = { ...props, text };
    cursor = 0;
    tree = exports.default(props);
    if (effect) { cleanup?.(); const callback = effect; effect = undefined; cleanup = callback(); }
    return tree;
  }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(value => nodes(value));
    return [node, ...nodes(node.props?.children)];
  }
  function button(label) {
    const found = nodes(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || node.props.children === label));
    assert.ok(found, `Missing button: ${label}`);
    return found;
  }
  async function tick(ms) {
    now += ms;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    await flush();
  }
  async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); }
  async function respond(items, index = requests.length - 1) {
    requests[index].resolve({ ok: true, json: async () => ({ grammar: items }) });
    await flush();
  }
  render();
  return { render, nodes, button, tick, flush, respond, requests, changes, unmount: () => cleanup?.(),
    content: () => JSON.stringify(tree), click: label => button(label).props.onClick() };
}

const item = { original: 'walk', replacement: 'walks', explanation: 'Match the verb to she.' };

test('checks on opening; edits debounce for 1500ms and rapid edits reset the timer', async () => {
  const h = harness();
  await h.tick(0);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { text: 'She walk home.', mode: 'grammar' });
  h.render('She walk away.');
  assert.equal(h.requests[0].options.signal.aborted, true);
  await h.tick(1000);
  h.render('She walk far.');
  await h.tick(1499);
  assert.equal(h.requests.length, 1);
  await h.tick(1);
  assert.equal(h.requests.length, 2);
});

test('ignores stale success and failure even if fetch ignores abort', async () => {
  const h = harness();
  await h.tick(0);
  h.render('They run home.');
  await h.tick(1500);
  await h.respond([{ original: 'run', replacement: 'ran' }], 1);
  await h.respond([item], 0);
  assert.ok(h.content().includes('ran'));
  assert.ok(!h.content().includes('Match the verb'));
  const other = harness();
  await other.tick(0);
  other.render('New story.');
  other.requests[0].reject(new Error('late error'));
  await other.flush();
  assert.ok(!other.content().includes('Select Check Grammar to retry'));
  assert.equal(other.changes.length, 0);
});

test('accept replaces only the unique complete wording and treats dollars literally', async () => {
  const h = harness('She walk home. A walker waits.');
  await h.tick(0);
  // A substring elsewhere makes the response ambiguous and must be blocked.
  await h.respond([item]);
  assert.equal(h.button('Accept suggestion 1').props.disabled, true);
  h.click('Accept suggestion 1');
  assert.equal(h.changes.length, 0);
  const unique = harness();
  await unique.tick(0);
  await unique.respond([{ ...item, replacement: '$& walks' }]);
  unique.click('Accept suggestion 1');
  assert.deepEqual(unique.changes, ['She $& walks home.']);
  unique.render(unique.changes[0]);
  assert.ok(!unique.content().includes('Accept suggestion'));
  await unique.tick(1499);
  assert.equal(unique.requests.length, 1);
  await unique.tick(1);
  assert.equal(unique.requests.length, 2);
});

test('dismiss updates the count and final success state without changing text', async () => {
  const h = harness();
  await h.tick(0);
  await h.respond([item, { original: 'home', replacement: 'outside' }]);
  assert.ok(h.content().includes('[2," to review"]'));
  h.click('Dismiss suggestion 1'); h.render();
  assert.ok(h.content().includes('[1," to review"]'));
  h.click('Dismiss suggestion 1'); h.render();
  assert.ok(h.content().includes('All caught up!'));
  assert.ok(h.content().includes('[0," to review"]'));
  assert.deepEqual(h.changes, []);
});

for (const [text, suggestion] of [
  ['walk walk', item], ['walking', item], ['She walked.', item],
  ['walk', { original: 'walk', replacement: 'walk' }],
  ['éwalk', item], ['walk字', item],
]) test(`blocks unsafe replacement: ${text}`, async () => {
  const h = harness(text);
  await h.tick(0); await h.respond([suggestion]);
  assert.equal(h.button('Accept suggestion 1').props.disabled, true);
  h.click('Accept suggestion 1'); assert.deepEqual(h.changes, []);
});

test('supports removing text and unicode complete words', async () => {
  const h = harness('A très nice story.');
  await h.tick(0); await h.respond([{ original: 'très', replacement: '' }]);
  h.click('Accept suggestion 1');
  assert.deepEqual(h.changes, ['A  nice story.']);
});

test('empty stories skip requests; clearing cancels pending work and hides old suggestions', async () => {
  const h = harness('  ');
  await h.tick(2000); assert.equal(h.requests.length, 0);
  assert.ok(h.content().includes('Every story starts'));
  h.render('She walk home.'); await h.tick(1500);
  h.render(''); await h.respond([item]);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.ok(!h.content().includes('Accept suggestion'));
  assert.deepEqual(h.changes, []);
});

test('loading, API failure, retry, malformed results, and empty success', async () => {
  const h = harness();
  await h.tick(0); assert.ok(h.content().includes('Checking your words'));
  h.requests[0].resolve({ ok: false }); await h.flush();
  assert.ok(h.content().includes('Select Check Grammar to retry'));
  h.click('Check Grammar'); h.render(); await h.tick(0);
  assert.equal(h.requests.length, 2);
  await h.respond([{ original: '', replacement: 'bad' }]);
  assert.ok(h.content().includes('Select Check Grammar to retry'));
  h.click('Check Grammar'); h.render(); await h.tick(0); await h.respond([]);
  assert.ok(h.content().includes('All caught up!'));
  assert.deepEqual(h.changes, []);
});

test('unmount aborts requests and ignores later responses', async () => {
  const h = harness(); await h.tick(0); h.unmount();
  assert.equal(h.requests[0].options.signal.aborted, true);
  await h.respond([item]);
  assert.ok(!h.content().includes('Accept suggestion'));
});
