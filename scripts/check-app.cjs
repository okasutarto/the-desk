// Run: npm run check:app. No network or paid API calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const loadModule = (file) => import('data:text/javascript;base64,' + Buffer.from(source(file)).toString('base64'));

async function main() {
  const { formatMessageWithLinks: format } = await loadModule('src/features/portfolio2d/utils/formatChatMessage.js');
  assert.equal(format('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(format('**<svg onload=alert(1)>**'), '<strong class="font-bold">&lt;svg onload=alert(1)&gt;</strong>');
  for (const url of ['javascript:alert', 'JaVaScRiPt:alert', 'data:text/html,evil', 'java\nscript:alert', '/relative']) {
    assert.ok(!format(`[click](${url})`).includes('<a '), url);
  }
  assert.ok(format('[<img src=x>](https://example.com/" onmouseover="evil)').includes('&lt;img src=x&gt;</a>'));
  assert.ok(!format('[click](https://example.com/" onmouseover="evil)').includes('" onmouseover='));
  assert.ok(!format('[click](https://example.com/**" onmouseover="evil**)').includes('<strong'));
  assert.ok(format('[email](mailto:oka@example.com)').includes('href="mailto:oka@example.com"'));
  assert.ok(format('[work](https://example.com/?a=1&b=2)').includes('a=1&amp;b=2'));
  assert.equal(format('Hello **Oka**\nNext'), 'Hello <strong class="font-bold">Oka</strong><br>Next');
  assert.equal((format('- A\n- B').match(/class="flex gap-2 my-1"/g) || []).length, 2);

  const themeSource = source('src/shared/composables/useTheme.js').replace(/^import .*\n/, '').replace('export function', 'function');
  function theme(storage) {
    const classes = new Set();
    const api = vm.runInNewContext(themeSource + '; useTheme()', {
      ref: value => ({ value }), localStorage: storage,
      document: { documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } } },
    });
    return { api, classes };
  }
  const blocked = theme({ getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } });
  blocked.api.initTheme();
  assert.equal(blocked.api.isDark.value, false);
  blocked.api.toggleTheme();
  assert.ok(blocked.classes.has('dark'));
  const stored = new Map([['theme', 'dark']]);
  const normal = theme({ getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) });
  normal.api.initTheme();
  assert.ok(normal.classes.has('dark'));
  normal.api.toggleTheme();
  assert.equal(stored.get('theme'), 'light');

  // Capture the actual server's CORS middleware without starting a server or loading credentials.
  let corsOptions;
  const app = { use() {}, get() {}, listen() {} };
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  vm.runInNewContext(source('my-portfolio-api/index.js'), {
    module: { exports: {} }, process: { env: {} }, console,
    require(name) {
      if (name === 'express') return express;
      if (name === 'cors') return options => { corsOptions = options; };
      if (name === 'dotenv') return { config() {} };
      if (name === './src/routes/api') return {};
      if (['helmet', 'express-rate-limit'].includes(name)) return () => {};
      throw Error('Unexpected dependency: ' + name);
    },
  });
  for (const origin of ['http://localhost:8080', 'https://okasp.dev', undefined]) {
    corsOptions.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  // Refused without an error, so the server answers normally (no CORS headers) instead of a 500
  corsOptions.origin('https://untrusted.example', (error, allowed) => { assert.equal(error, null); assert.equal(allowed, false); });

  const { getStreamingResponse: stream } = await loadModule('src/shared/services/chatApi.js');
  const originalFetch = global.fetch;
  let cancelled;
  const mockStream = chunks => {
    cancelled = false;
    global.fetch = async () => ({ ok: true, body: new ReadableStream({
      start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); },
    }) });
  };
  try {
    mockStream(['data: {"content":"Hi ', 'Oka"}\n', '\ndata: [DO', 'NE]\n\n']);
    const tokens = [];
    assert.deepEqual(await stream('hello', token => tokens.push(token)), { text: 'Hi Oka', signature: undefined });
    assert.deepEqual(tokens, ['Hi Oka']);
    // The answer's signature arrives as its own event and comes back for the history
    mockStream(['data: {"content":"Hi"}\n\ndata: {"signature":"ab12"}\n\ndata: [DONE]\n\n']);
    assert.deepEqual(await stream('hello', () => {}), { text: 'Hi', signature: 'ab12' });
    const { toHistory } = await loadModule('src/shared/services/chatApi.js');
    assert.deepEqual(toHistory([{ sender: 'user', text: 'q' }, { sender: 'bot', text: 'a', signature: 'ab12' }, { sender: 'bot', text: 'Oops' }]), [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a', signature: 'ab12' },
      { role: 'assistant', content: 'Oops', signature: undefined },
    ]);
    mockStream(['data: {"content":"partial"}\n\n']);
    await assert.rejects(stream('hello', () => {}), /before completion/);
    mockStream(['data: [DONE]\r\n\r\n']);
    assert.deepEqual(await stream('hello', () => {}), { text: '', signature: undefined });
    global.fetch = async () => ({ ok: true, body: new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: broken\n\n')); },
      cancel() { cancelled = true; },
    }) });
    await assert.rejects(stream('hello', () => {}), SyntaxError);
    // Cancellation propagates through TextDecoderStream asynchronously.
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(cancelled);
    global.fetch = async () => ({ ok: false, status: 429, json: async () => ({ scope: 'visitor', retryAfter: 120 }) });
    await assert.rejects(stream('hello', () => {}), (error) => error.status === 429 && error.scope === 'visitor' && error.retryAfter === 120);
    global.fetch = async () => ({ ok: false, status: 429, json: async () => { throw new SyntaxError('not json'); } });
    await assert.rejects(stream('hello', () => {}), (error) => error.status === 429 && error.retryAfter === undefined);
    global.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(stream('hello', () => {}), (error) => error.status === 500);
    // Both chats (2D bot and the desk phone) word a rate limit the same way
    const { chatErrorReply } = await loadModule('src/shared/services/chatApi.js');
    assert.match(chatErrorReply({ status: 500 }), /wires got tangled/);
    assert.match(chatErrorReply(new TypeError('Failed to fetch')), /wires got tangled/);
    assert.match(chatErrorReply({ status: 429, scope: 'visitor', retryAfter: 120 }), /2 minutes/);
    assert.match(chatErrorReply({ status: 429, scope: 'visitor', retryAfter: 30 }), /1 minute to/);
    assert.match(chatErrorReply({ status: 429, scope: 'everyone', retryAfter: 9000 }), /tomorrow/);

    // The visit count: the live site counts a tab once, a local one only reads, and the room and
    // the app share one request
    const session = new Map();
    global.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) };
    const requests = [];
    global.fetch = async (url, { method }) => { requests.push(method); return { ok: true, json: async () => ({ total: 7 }) }; };
    let fresh = 0;
    const loadVisits = () => import('data:text/javascript;base64,' + Buffer.from(source('src/shared/services/visitsApi.js') + `\n// ${fresh++}`).toString('base64'));
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      let { getVisits } = await loadVisits();
      assert.deepEqual(await Promise.all([getVisits(), getVisits()]), [7, 7]);
      ({ getVisits } = await loadVisits());
      await getVisits();
      assert.deepEqual(requests, ['POST', 'GET']);
      process.env.NODE_ENV = 'development';
      session.clear();
      ({ getVisits } = await loadVisits());
      await getVisits();
      assert.equal(requests.at(-1), 'GET');
      global.fetch = async () => ({ ok: false, status: 503 });
      ({ getVisits } = await loadVisits());
      await assert.rejects(getVisits(), (error) => error.status === 503);
      global.fetch = async () => ({ ok: true, json: async () => ({ total: 8 }) });
      assert.equal(await getVisits(), 8, 'a failed count is asked again');
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete global.sessionStorage;
    }
  } finally {
    global.fetch = originalFetch;
  }

  // The API counts each person once, and not the bots
  const people = new Set();
  const visitsApi = { exports: {} };
  vm.runInNewContext(source('my-portfolio-api/src/controllers/visitsController.js'), {
    module: visitsApi, process: { env: { VISITS_SECRET: 'test' } }, console: { warn() {}, error() {} },
    require(name) {
      if (name === 'crypto') return require('node:crypto');
      if (name === '../services/redis') return { sadd: async (key, id) => people.add(id), scard: async () => people.size };
      if (name === '../middleware/chatRateLimit') return { visitorIp: req => req.ip };
      throw Error('Unexpected dependency: ' + name);
    },
  });
  const visit = async (method, ip, agent) => {
    let body;
    await visitsApi.exports.visits(
      { method, ip, get: header => (header === 'user-agent' ? agent : undefined) },
      { setHeader() {}, status() { return this; }, json(value) { body = value; } },
    );
    return body.total;
  };
  const browser = 'Mozilla/5.0 (Macintosh) Safari/605.1.15';
  assert.equal(await visit('POST', '1.1.1.1', browser), 1);
  assert.equal(await visit('POST', '1.1.1.1', browser), 1, 'a second visit adds nobody');
  assert.equal(await visit('POST', '2.2.2.2', browser), 2);
  assert.equal(await visit('GET', '3.3.3.3', browser), 2, 'reading counts nobody');
  for (const agent of ['Googlebot/2.1', 'WhatsApp/2.23', 'curl/8.4.0', 'Mozilla/5.0 HeadlessChrome/120', undefined]) {
    assert.equal(await visit('POST', '4.4.4.4', agent), 2, String(agent));
  }
  await require('./check-app-strike.cjs')();
  await require('./check-app-guestbook.cjs')();
  console.log('App checks passed: safe chat formatting, storage fallback, CORS, SSE completion/errors, the visit count, the bounty board and the guestbook.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
