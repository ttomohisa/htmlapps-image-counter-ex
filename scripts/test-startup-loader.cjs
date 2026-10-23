const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const builder = fs.readFileSync(path.join(root, 'scripts/build-self-extract.ps1'), 'utf8');
const wrapper = process.env.IMAGE_COUNTER_LOADER_HTML
  ? fs.readFileSync(process.env.IMAGE_COUNTER_LOADER_HTML, 'utf8')
  : builder.match(/\$wrapper = @"\r?\n([\s\S]*?)\r?\n"@/)[1];
const loader = [...wrapper.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match => !match[0].includes('id="self-extract-payload"'))
  .map(match => match[1]).join('\n');

function runLoader(payload, { supported = true } = {}) {
  let clock = 0, decoded = 0, finish;
  const state = { stages: [], yields: [], writes: [], errors: [], finished: false };
  const elements = new Map();
  for (const id of ['self-extract-payload', 'status', 'progress', 'error']) {
    elements.set(id, { textContent: id === 'self-extract-payload' ? payload : '' });
  }
  const done = new Promise(resolve => { finish = resolve; });
  const finishRun = () => { state.finished = true; finish(state); };
  const body = {
    dataset: new Proxy({}, { set(target, key, value) { target[key] = value; if (key === 'phase') state.stages.push(value); return true; } }),
    classList: { add(value) { if (value === 'failed') queueMicrotask(finishRun); } }
  };
  const context = {
    document: {
      body, getElementById(id) { return elements.get(id); },
      open(type, mode) { assert.equal(type, 'text/html'); assert.equal(mode, 'replace'); },
      write(html) { state.writes.push({ html, phase: body.dataset.phase }); },
      close: finishRun
    },
    Blob, Response, Uint8Array, Error,
    atob(value) { decoded += value.length; clock += 4; return atob(value); },
    performance: { now() { return clock; } },
    setTimeout(callback, delay) {
      state.yields.push({ decoded, phase: body.dataset.phase });
      return setTimeout(callback, delay);
    },
    console: { error(error) { state.errors.push(error); } }
  };
  if (supported) context.DecompressionStream = DecompressionStream;
  context.window = context;
  vm.runInNewContext(loader, context);
  return { state, done, elements, get decoded() { return decoded; } };
}

const encode = html => zlib.gzipSync(Buffer.from(html)).toString('base64');

test('the notice precedes the large payload and decoding yields before blocking work', { timeout: 5000 }, async () => {
  assert.ok(wrapper.indexOf('<main>') < wrapper.indexOf('id="self-extract-payload"'));
  const run = runLoader(encode('<!doctype html><title>Ready</title>'));
  assert.equal(run.decoded, 0, 'the browser must receive a task boundary before decoding starts');
  await run.done;
  assert.deepEqual(run.state.stages, ['decoding', 'unpacking', 'starting']);
  assert.equal(run.state.writes.length, 1);
  assert.equal(run.state.writes[0].phase, 'starting');
  assert.ok(run.state.yields.some(entry => entry.phase === 'starting'), 'starting notice must get a rendering opportunity before document replacement');
});

test('large payload decoding yields partway through and restores exact Unicode HTML', { timeout: 5000 }, async () => {
  const expected = '<!doctype html><meta charset="utf-8"><title>画像 / Image</title><!--' + crypto.randomBytes(320000).toString('base64') + '-->';
  const payload = encode(expected).replace(/.{100}/g, '$&\n');
  const run = runLoader(payload);
  await run.done;
  assert.deepEqual(run.state.writes.map(entry => entry.html), [expected]);
  const decodedLength = payload.replace(/\s+/g, '').length;
  assert.ok(run.state.yields.some(entry => entry.decoded > 0 && entry.decoded < decodedLength), 'long decode must let other tasks run before completion');
  assert.equal(run.state.errors.length, 0);
});

test('a browser without native gzip support shows an error without replacing the page', { timeout: 5000 }, async () => {
  const run = runLoader(encode('<!doctype html><title>Ready</title>'), { supported: false });
  await run.done;
  assert.equal(run.state.writes.length, 0);
  assert.equal(run.state.stages.at(-1), 'error');
  assert.match(run.elements.get('error').textContent, /DecompressionStream/);
});

test('corrupt gzip leaves the error notice available without replacing the page', { timeout: 5000 }, async () => {
  const run = runLoader(Buffer.from('not a gzip stream').toString('base64'));
  await run.done;
  assert.equal(run.state.writes.length, 0);
  assert.equal(run.state.stages.at(-1), 'error');
  assert.ok(run.elements.get('error').textContent.length > 0);
});

test('a restored non-HTML payload is rejected before document replacement', { timeout: 5000 }, async () => {
  const run = runLoader(encode('plain text'));
  await run.done;
  assert.equal(run.state.writes.length, 0);
  assert.equal(run.state.stages.at(-1), 'error');
  assert.match(run.elements.get('error').textContent, /not an HTML document/);
});

let appSource = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(root, 'src/index.template.html'), 'utf8');
if (appSource.includes('id="self-extract-payload"')) {
  appSource = zlib.gunzipSync(Buffer.from(appSource.match(/<script id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/)[1], 'base64')).toString('utf8');
}

test('the readable notice is available before the embedded assets arrive', () => {
  const notice = appSource.indexOf('id="appStartup"'), assets = appSource.indexOf(',ASSETS=');
  assert.ok(notice > 0 && notice < assets, 'the initial notice must precede the large inline asset bundle');
  const tag = appSource.slice(appSource.lastIndexOf('<', notice), appSource.indexOf('>', notice) + 1);
  assert.doesNotMatch(tag, /\bhidden\b/, 'the notice must be visible before any application JavaScript runs');
});

test('the readable notice clears once the start screen is ready, before a slow draft read', async () => {
  const startup = { hidden: false }, events = [];
  let resolveDraft;
  const pendingDraft = new Promise(resolve => { resolveDraft = resolve; });
  const context = {
    $: selector => selector === '#appStartup' ? startup : { textContent: '' },
    applyLang() { events.push('language'); }, updateHistoryButtons() {},
    showStart() { events.push('start'); assert.equal(startup.hidden, false); },
    dbGet() { events.push('draft'); return pendingDraft; },
    APP_CONFIG: { version: 'test' }, BUILD_MANIFEST: {}, restoreOfferGeneration: 0,
    console: { error(error) { throw error; } }
  };
  const init = appSource.slice(appSource.indexOf('async function init()'), appSource.indexOf('\ninit();'));
  vm.runInNewContext(init + '\nthis.pendingInit=init();', context);
  assert.deepEqual(events, ['language', 'start', 'draft']);
  assert.equal(startup.hidden, true, 'IndexedDB may be slow; it must not keep the ready app covered');
  resolveDraft(undefined);
  await context.pendingInit;
});
