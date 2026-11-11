// The guestbook's API (my-portfolio-api): what a note may say, moderation, pages newest first,
// rate limits and the admin's take-down. Run by check-app.cjs, with the API's packages stubbed
// as CI doesn't install them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load(file, context, deps = {}) {
  const module = { exports: {} };
  vm.runInNewContext(source(file), {
    module, exports: module.exports, console: { warn() {}, error() {}, log() {} }, Buffer, ...context,
    require(name) {
      if (name === 'crypto') return require('node:crypto');
      if (name in deps) return deps[name];
      throw Error(`Unexpected dependency of ${file}: ${name}`);
    },
  });
  return module.exports;
}

module.exports = async function checkGuestbook() {
  // ---------- what a note may say ----------
  const guard = load('my-portfolio-api/src/utils/nameGuard.js', {});
  const { checkName, checkMessage, MAX_MESSAGE } = guard;
  assert.equal(MAX_MESSAGE, 120);
  assert.equal(checkName('Monkey D. Luffy', 20).ok, true, 'a guestbook name may be twenty long');
  assert.equal(checkName('Monkey D. Luffy', 12).reason, 'long', 'a bounty name may not');
  assert.deepEqual({ ...checkMessage('  Keren   banget\nwebsitenya!  ') }, { ok: true, message: 'Keren banget websitenya!' }, 'spaces and lines tidied');
  for (const ok of ['Mantap bro 🔥🔥', 'Salam dari Jakarta 👋', 'Love the cat! ♡', 'ルフィ最高', 'Halo. Com on!', 'Masuk akal', 'Babies are cute']) {
    assert.equal(checkMessage(ok).ok, true, ok);
  }
  assert.equal(checkMessage('').reason, 'empty');
  assert.equal(checkMessage('🔥🔥🔥').reason, 'empty', 'emoji alone say nothing');
  assert.equal(checkMessage('...').reason, 'empty');
  assert.equal(checkMessage('x'.repeat(121)).reason, 'long');
  assert.equal(checkMessage('x'.repeat(120)).ok, true);
  for (const link of ['cek http://spam.io', 'www.judi.online', 'main di judi.com', 'bit.ly/abc', 'kunjungi slot88 (dot) com', 'ftp://x']) {
    assert.equal(checkMessage(link).reason, 'link', link);
  }
  assert.equal(checkMessage('hi‮ereht').reason, 'characters', 'no flipped text');
  assert.equal(checkMessage('hi\u0007').reason, 'characters', 'no control characters');
  for (const bad of ['dasar anjing', 'b4ngsat lu', 'website kontol', 'f u c k this']) assert.equal(checkMessage(bad).reason, 'words', bad);

  // ---------- the store, in memory as a local server keeps it ----------
  let now = 1_700_000_000_000;
  const clock = class extends Date { static now() { return now; } };
  const storeModule = load('my-portfolio-api/src/services/guestbookStore.js', { process: { env: {} }, Date: clock }, { './redis': null });
  assert.ok(storeModule.store);
  assert.equal(load('my-portfolio-api/src/services/guestbookStore.js', { process: { env: { NODE_ENV: 'production' } }, Date }, { './redis': null }).store, null);

  // ---------- the controller ----------
  const flagged = new Set();
  const book = load('my-portfolio-api/src/controllers/guestbookController.js', { process: { env: { ADMIN_SECRET: 'admin-secret' } }, Date: clock, Number }, {
    '../services/guestbookStore': { store: storeModule.memoryStore() },
    '../utils/nameGuard': guard,
    '../services/moderation': { flagged: async (text) => [...flagged].some((word) => text.includes(word)) },
    './visitsController': { visitorId: (req) => req.ip, isPerson: (req) => !/bot/i.test(req.agent || '') },
  });
  const call = async (handler, { ip = '1.1.1.1', body, query = {}, params = {}, headers = {}, agent = 'Mozilla/5.0' } = {}) => {
    let status = 200;
    let json;
    await book[handler](
      { ip, agent, body, query, params, get: (h) => headers[h.toLowerCase()] },
      { setHeader() {}, status(code) { status = code; return this; }, json(value) { json = value; } },
    );
    return { status, ...json };
  };
  const sign = (ip, name, message) => {
    now += 1000;
    return call('add', { ip, body: { name, message } });
  };

  let res = await call('list');
  assert.equal(res.notes.length, 0);
  assert.equal(res.more, false);

  res = await sign('1.1.1.1', 'Nami', 'The cat is adorable!');
  assert.equal(res.status, 200, JSON.stringify(res));
  assert.equal(res.note.name, 'Nami');
  assert.ok(res.note.id && res.note.at && res.note.paper >= 0 && res.note.paper < 6, 'a paper at random when none is asked for');
  // the paper the visitor wrote on is the one it goes up on
  res = await call('add', { ip: '7.7.7.7', body: { name: 'Robin', message: 'Lovely room', paper: 4 } });
  assert.equal(res.note.paper, 4);
  for (const paper of [9, -1, 2.5, '3']) {
    res = await call('add', { ip: `7.7.8.${String(paper).length}${paper < 0 ? 1 : 0}`, body: { name: 'Robin', message: `paper ${paper}`, paper } });
    assert.ok(Number.isInteger(res.note.paper) && res.note.paper >= 0 && res.note.paper < 6, `a paper that isn't one (${paper}) gets one at random`);
  }

  // refusals say which line and why
  res = await sign('2.2.2.2', '', 'hello');
  assert.deepEqual([res.status, res.field, res.reason], [422, 'name', 'empty']);
  res = await sign('2.2.2.2', 'Zoro', 'main ke judi.com');
  assert.deepEqual([res.status, res.field, res.reason], [422, 'message', 'link']);
  flagged.add('nasty');
  res = await sign('2.2.2.2', 'Zoro', 'something nasty');
  assert.deepEqual([res.status, res.field, res.reason], [422, 'message', 'words'], 'moderation catches what the list misses');
  assert.equal((await call('add', { ip: '3.3.3.3', agent: 'Googlebot', body: { name: 'Bot', message: 'hi' } })).status, 403, 'bots don\'t sign');

  // three a day each
  for (const n of [1, 2]) assert.equal((await sign('1.1.1.1', 'Nami', `again ${n}`)).status, 200);
  res = await sign('1.1.1.1', 'Nami', 'one too many');
  assert.deepEqual([res.status, res.scope], [429, 'visitor']);
  now += 25 * 60 * 60 * 1000;
  assert.equal((await sign('1.1.1.1', 'Nami', 'the next day')).status, 200, 'tomorrow is another day');

  // two pinned in the same millisecond, either side of a page's end, each still land on a page
  for (let i = 0; i < 9; i++) await sign(`6.6.${i}.1`, 'Tie', `tie ${i}`);
  now += 1000;
  for (const ip of ['6.7.0.1', '6.7.0.2']) await call('add', { ip, body: { name: 'Tie', message: `same ms ${ip}` } });
  const ties = [];
  let cursor;
  do {
    const pageOf = await call('list', { query: cursor ? { before: String(cursor) } : {} });
    ties.push(...Array.from(pageOf.notes, (n) => n.message));
    cursor = pageOf.next;
  } while (cursor);
  assert.ok(ties.includes('same ms 6.7.0.1') && ties.includes('same ms 6.7.0.2'), 'notes pinned in the same millisecond are both on a page');
  assert.equal(new Set(ties).size, ties.length, 'and none is on two pages');

  // pages of ten, newest first
  for (let i = 0; i < 14; i++) await sign(`9.9.${i}.1`, `Crew ${i}`, `note ${i}`);
  const first = await call('list');
  assert.equal(first.notes.length, 10);
  assert.equal(first.more, true);
  assert.equal(first.notes[0].message, 'note 13', 'newest first');
  assert.ok(first.notes.every((note, i) => i === 0 || note.at < first.notes[i - 1].at));
  const second = await call('list', { query: { before: String(first.next) } });
  assert.equal(second.notes[0].message, 'note 3', 'the next page carries on where the first ended');
  assert.equal(second.more, true);
  let total = 0;
  let pages = 0;
  for (let next; ; ) {
    const pageOf = await call('list', { query: next ? { before: String(next) } : {} });
    total += pageOf.notes.length;
    pages++;
    next = pageOf.next;
    if (!next) {
      assert.equal(pageOf.more, false, 'the last page says so');
      break;
    }
  }
  assert.equal(total, 34, 'every note on one page or another');
  assert.equal(pages, 4);

  // the admin takes a note down
  const gone = first.notes[0].id;
  assert.equal((await call('remove', { params: { id: gone }, headers: { 'x-admin-secret': 'nope-nope-no' } })).status, 403);
  assert.equal((await call('remove', { params: { id: gone }, headers: { 'x-admin-secret': 'admin-secret' } })).removed, true);
  assert.ok(!(await call('list')).notes.some((note) => note.id === gone));

  const routes = source('my-portfolio-api/src/routes/api.js');
  for (const route of ["get('/guestbook'", "post('/guestbook'", "delete('/guestbook/:id'"]) assert.ok(routes.includes(route), route);
};
