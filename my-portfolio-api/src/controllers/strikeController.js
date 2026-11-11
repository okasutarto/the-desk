const crypto = require('crypto');
const { store } = require('../services/leaderboardStore');
const { checkName } = require('../utils/nameGuard');
const { visitorId, isPerson } = require('./visitsController');

/**
 * Straw Hat Strike's bounty board: the best bounty of each player, the top ten shown to all.
 *
 * A run starts with a signed token (POST /strike/run) and ends by handing it back with the
 * score (POST /strike/score). The score is counted in the browser, so a determined cheat can
 * always forge one; the token only makes it harder: it must be genuine, unspent and old
 * enough for the score claimed, and the score must fit the time it took.
 */

const SECRET = process.env.STRIKE_SECRET || process.env.VISITS_SECRET || '';
if (!SECRET) console.warn('STRIKE_SECRET is not set; Straw Hat Strike run tokens are signed with an empty key');

const BOARD = 10;
// A run token lives this long (a long game, paused for lunch)
const TOKEN_TTL = 3 * 60 * 60;
// The quickest a run can end and still post: the first waves take a few seconds to sink
const MIN_RUN = 5;
// The most a run can earn for how long it took and how far it got. Generous: a full ×8 chain on
// frigates is 6,400 a kill, a Sea King 40,000 and the stage bonus 10,000 a stage.
const maxScore = (seconds, stage) => 4000 * seconds + 60000 * stage;
// A stage takes at least 42 s of sailing, a warning and a Sea King; 40 s leaves room
const maxStage = (seconds) => 1 + Math.floor(seconds / 40);
const MAX_BOUNTY = 1e9;
// Per player: new runs and posted scores in an hour
const LIMITS = { run: 120, score: 30 };
const HOUR = 60 * 60;

const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

function readToken(token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [nonce, startedAt, signature] = token.split('.');
  if (!nonce || !startedAt || !signature) return null;
  const expected = sign(`${nonce}.${startedAt}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const started = Number(startedAt);
  const seconds = (now - started) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > TOKEN_TTL) return null;
  return { nonce, seconds };
}

// The board as everyone sees it: names, bounties and stages, best first
const publicBoard = (rows) => rows.map(({ id, name, score, stage, at }, i) => ({
  id, rank: i + 1, name, score: Number(score), stage: Number(stage), at: Number(at),
}));

// OpenAI's moderation on the name (free to call). Unflagged or unreachable lets it through:
// the word list has already run, and a name can always be taken down afterwards.
let moderate = async (name) => {
  if (!process.env.OPENAI_API_KEY) return false;
  try {
    const { openai } = require('../services/openaiService');
    const result = await openai.moderations.create({ model: 'omni-moderation-latest', input: name });
    return Boolean(result.results?.[0]?.flagged);
  } catch (error) {
    console.error('Name moderation unavailable:', error.message);
    return false;
  }
};

async function limited(kind, id) {
  return (await store.hit(`${kind}:${id}`, HOUR)) > LIMITS[kind];
}

function unavailable(res) {
  return res.status(503).json({ error: 'The bounty board is not configured' });
}

// GET /strike/top
async function top(req, res) {
  if (!store) return unavailable(res);
  try {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10');
    res.json({ top: publicBoard(await store.top(BOARD)) });
  } catch (error) {
    console.error('Bounty board store error:', error);
    res.status(503).json({ error: 'The bounty board is unavailable' });
  }
}

// POST /strike/run: a token for the run that's starting
async function run(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) return unavailable(res);
  try {
    if (await limited('run', visitorId(req))) return res.status(429).json({ error: 'Too many runs, try again later' });
    const nonce = crypto.randomBytes(12).toString('base64url');
    const startedAt = String(Date.now());
    res.json({ token: `${nonce}.${startedAt}.${sign(`${nonce}.${startedAt}`)}` });
  } catch (error) {
    console.error('Bounty board store error:', error);
    res.status(503).json({ error: 'The bounty board is unavailable' });
  }
}

// POST /strike/score { token, score, stage, name }
async function score(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) return unavailable(res);
  if (!isPerson(req)) return res.status(403).json({ error: 'Only players can post a bounty' });
  const { token, score: claimed, stage, name } = req.body || {};
  const ticket = readToken(token);
  if (!ticket) return res.status(400).json({ error: 'That run has no valid ticket', reason: 'token' });
  if (!Number.isInteger(claimed) || claimed <= 0 || claimed > MAX_BOUNTY || !Number.isInteger(stage) || stage < 1) {
    return res.status(400).json({ error: 'That bounty does not add up', reason: 'score' });
  }
  if (ticket.seconds < MIN_RUN || stage > maxStage(ticket.seconds) || claimed > maxScore(ticket.seconds, stage)) {
    return res.status(400).json({ error: 'That bounty does not add up', reason: 'score' });
  }
  const checked = checkName(name);
  if (!checked.ok) return res.status(422).json({ error: 'Pick another name', reason: checked.reason });
  try {
    const id = visitorId(req);
    if (await limited('score', id)) return res.status(429).json({ error: 'Too many bounties posted, try again later' });
    // The token is spent last, so a refused name can be fixed and sent again
    if (await moderate(checked.name)) return res.status(422).json({ error: 'Pick another name', reason: 'words' });
    if (!(await store.spend(ticket.nonce, TOKEN_TTL))) return res.status(409).json({ error: 'That run was already posted', reason: 'token' });
    const best = await store.best(id);
    // One line on the board per player: their best run, under the name it was posted with
    const improved = best === null || claimed > best;
    if (improved) await store.save(id, { name: checked.name, score: claimed, stage, at: Date.now() });
    res.json({
      improved,
      rank: await store.rank(id),
      top: publicBoard(await store.top(BOARD)),
    });
  } catch (error) {
    console.error('Bounty board store error:', error);
    res.status(503).json({ error: 'The bounty board is unavailable' });
  }
}

// DELETE /strike/score/:id with the X-Admin-Secret header: take a line off the board
async function remove(req, res) {
  const secret = process.env.ADMIN_SECRET;
  const given = String(req.get('x-admin-secret') || '');
  if (!secret || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!store) return unavailable(res);
  try {
    res.json({ removed: await store.remove(String(req.params.id)) });
  } catch (error) {
    console.error('Bounty board store error:', error);
    res.status(503).json({ error: 'The bounty board is unavailable' });
  }
}

module.exports = {
  top, run, score, remove, readToken, maxScore, maxStage,
  // for the checks: swap the moderation call
  setModeration(fn) { moderate = fn; },
};
