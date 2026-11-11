// The bounty board's API (my-portfolio-api): run tickets, the score's plausibility, the name
// guard, one line per player, rate limits and the admin's take-down. Run by check-app.cjs.
// Loaded in a VM with its dependencies stubbed, as CI doesn't install the API's packages.
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

module.exports = async function checkStrike() {
  // ---------- the name guard ----------
  const { checkName, MAX_NAME } = load('my-portfolio-api/src/utils/nameGuard.js', {});
  assert.equal(MAX_NAME, 12);
  assert.deepEqual({ ...checkName('  Monkey   D. ') }, { ok: true, name: 'Monkey D.' }, 'spaces are tidied');
  for (const name of ['Zoro', 'Nami_99', "O'Hara!", 'Yasuo', 'Masuk', 'Babies', 'Ölaf', 'ルフィ', 'Sanji-kun']) {
    assert.equal(checkName(name).ok, true, `${name} is fine`);
  }
  assert.equal(checkName('').reason, 'empty');
  assert.equal(checkName('   ').reason, 'empty');
  assert.equal(checkName(42).reason, 'empty');
  assert.equal(checkName('ThirteenChars').reason, 'long');
  for (const name of ['http://x.io', 'a<b>', 'hi 🏴‍☠️', 'x@y', 'semi;colon']) assert.equal(checkName(name).reason, 'characters', name);
  for (const name of ['anjing', 'Dasar Anjing', '4NJ1NG', 'f u c k', 'fuuuck', 'BangSat99', 'asu', 'Asu Lu', 'kontol', 'n1gga']) {
    assert.equal(checkName(name).reason, 'words', name);
  }

  // ---------- the store, in memory as a local server keeps it ----------
  const storeModule = load('my-portfolio-api/src/services/leaderboardStore.js', { process: { env: {} }, Date }, { './redis': null });
  assert.ok(storeModule.store, 'a local server keeps the board in memory');
  const prod = load('my-portfolio-api/src/services/leaderboardStore.js', { process: { env: { NODE_ENV: 'production' } }, Date }, { './redis': null });
  assert.equal(prod.store, null, 'production without Redis has no board (503)');

  // ---------- the controller ----------
  let now = 1_000_000;
  const clock = class extends Date { static now() { return now; } };
  const env = { STRIKE_SECRET: 'test', ADMIN_SECRET: 'admin-secret' };
  const strike = load('my-portfolio-api/src/controllers/strikeController.js', { process: { env }, Date: clock }, {
    '../services/leaderboardStore': { store: storeModule.memoryStore() },
    '../utils/nameGuard': { checkName },
    './visitsController': { visitorId: (req) => req.ip, isPerson: (req) => !/bot/i.test(req.agent || '') },
    '../services/moderation': { flagged: async (name) => flagged.has(name) },
  });
  let flagged = new Set();

  const call = async (handler, { ip = '1.1.1.1', body, params = {}, headers = {}, agent = 'Mozilla/5.0' } = {}) => {
    let status = 200;
    let json;
    await strike[handler](
      { ip, agent, body, params, get: (h) => headers[h.toLowerCase()] },
      { setHeader() {}, status(code) { status = code; return this; }, json(value) { json = value; } },
    );
    return { status, ...json };
  };
  const ticket = async (ip) => (await call('run', { ip })).token;
  const later = (seconds) => { now += seconds * 1000; };

  assert.deepEqual([...(await call('top')).top], [], 'an empty board');

  // A run that adds up goes on the board
  let token = await ticket('1.1.1.1');
  assert.match(token, /^[\w-]+\.\d+\.[\w-]+$/);
  later(60);
  let res = await call('score', { body: { token, score: 50_000, stage: 2, name: 'Luffy' } });
  assert.equal(res.status, 200, JSON.stringify(res));
  assert.equal(res.rank, 1);
  assert.equal(res.improved, true);
  assert.equal(res.top[0].name, 'Luffy');
  assert.equal(res.top[0].score, 50_000);

  // A ticket spends once
  res = await call('score', { body: { token, score: 50_000, stage: 2, name: 'Luffy' } });
  assert.equal(res.status, 409);

  // Forged, too young, too old or too rich runs are refused
  res = await call('score', { body: { token: token.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), score: 10, stage: 1, name: 'Zoro' } });
  assert.equal(res.reason, 'token', 'a forged signature');
  token = await ticket('2.2.2.2');
  later(2);
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token, score: 100, stage: 1, name: 'Zoro' } })).reason, 'score', 'too quick');
  later(30);
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token, score: 10_000_000, stage: 1, name: 'Zoro' } })).reason, 'score', 'too rich for the time');
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token, score: 1000, stage: 9, name: 'Zoro' } })).reason, 'score', 'too far for the time');
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token, score: 10.5, stage: 1, name: 'Zoro' } })).reason, 'score', 'whole berries only');
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token, score: -5, stage: 1, name: 'Zoro' } })).reason, 'score');
  const old = await ticket('2.2.2.2');
  later(4 * 60 * 60);
  assert.equal((await call('score', { ip: '2.2.2.2', body: { token: old, score: 100, stage: 1, name: 'Zoro' } })).reason, 'token', 'an expired ticket');

  // A name that's refused can be fixed with the same ticket
  token = await ticket('2.2.2.2');
  later(40);
  res = await call('score', { ip: '2.2.2.2', body: { token, score: 30_000, stage: 1, name: 'b4ngsat' } });
  assert.equal(res.status, 422);
  assert.equal(res.reason, 'words');
  flagged = new Set(['Bad Pirate']);
  res = await call('score', { ip: '2.2.2.2', body: { token, score: 30_000, stage: 1, name: 'Bad Pirate' } });
  assert.equal(res.reason, 'words', 'moderation catches what the list misses');
  res = await call('score', { ip: '2.2.2.2', body: { token, score: 30_000, stage: 1, name: 'Zoro' } });
  assert.equal(res.status, 200, 'the fixed name goes up on the same ticket');
  assert.equal(res.rank, 2);

  // One line per player: a lower run keeps the best, a higher one replaces it
  token = await ticket('1.1.1.1');
  later(30);
  res = await call('score', { body: { token, score: 20_000, stage: 1, name: 'Lucy' } });
  assert.equal(res.improved, false);
  assert.equal(res.rank, 1);
  assert.equal(res.top.filter((row) => row.id === '1.1.1.1').length, 1);
  assert.equal(res.top[0].name, 'Luffy', 'the best run keeps its name');
  token = await ticket('1.1.1.1');
  later(120);
  res = await call('score', { body: { token, score: 400_000, stage: 3, name: 'Lucy' } });
  assert.equal(res.improved, true);
  assert.equal(res.top[0].name, 'Lucy');

  // Bots don't post
  token = await ticket('3.3.3.3');
  later(30);
  assert.equal((await call('score', { ip: '3.3.3.3', agent: 'Googlebot', body: { token, score: 100, stage: 1, name: 'Bot' } })).status, 403);

  // Rate limits
  for (let i = 0; i < 120; i++) await ticket('9.9.9.9');
  assert.equal((await call('run', { ip: '9.9.9.9' })).status, 429, 'too many runs an hour');

  // The top ten only, best first
  for (let i = 0; i < 12; i++) {
    const ip = `5.5.5.${i}`;
    const t = await ticket(ip);
    later(30);
    await call('score', { ip, body: { token: t, score: 1000 + i, stage: 1, name: `Crew ${i}` } });
  }
  const board = (await call('top')).top;
  assert.equal(board.length, 10);
  assert.deepEqual(Array.from(board, (row) => row.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(board.every((row, i) => i === 0 || row.score <= board[i - 1].score), 'best first');

  // The admin takes a line down
  assert.equal((await call('remove', { params: { id: '2.2.2.2' }, headers: { 'x-admin-secret': 'wrong-secret' } })).status, 403);
  assert.equal((await call('remove', { params: { id: '2.2.2.2' } })).status, 403);
  res = await call('remove', { params: { id: '2.2.2.2' }, headers: { 'x-admin-secret': 'admin-secret' } });
  assert.equal(res.removed, true);
  assert.ok(!(await call('top')).top.some((row) => row.name === 'Zoro'));

  // ---------- the routes ----------
  const routes = source('my-portfolio-api/src/routes/api.js');
  for (const route of ["get('/strike/top'", "post('/strike/run'", "post('/strike/score'", "delete('/strike/score/:id'"]) {
    assert.ok(routes.includes(route), route);
  }
};
