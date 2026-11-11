const crypto = require('crypto');
const { store } = require('../services/guestbookStore');
const { checkName, checkMessage } = require('../utils/nameGuard');
const moderation = require('../services/moderation');
const { visitorId, isPerson } = require('./visitsController');

/**
 * The guestbook on the room's cork board: short notes from visitors, shown to everyone as
 * soon as they pass the word list and OpenAI's moderation, newest first. Taken down by hand
 * (DELETE with the admin secret) when something gets through that shouldn't.
 */

const PAGE = 10;
const MAX_NAME = 20;
// Per visitor a day, and for everyone together a day, so a script can't paper the board over
const PER_VISITOR = 3;
const PER_DAY = Number(process.env.GUESTBOOK_DAILY_CAP) || 200;
const DAY = 24 * 60 * 60;
// The paper colours the room prints notes on: the one the visitor wrote on, kept with the note
// so everyone sees the same
const PAPERS = 6;

const shown = ({ id, name, message, at, paper }) => ({ id, name, message, at: Number(at), paper: Number(paper) || 0 });

function unavailable(res) {
  return res.status(503).json({ error: 'The guestbook is not configured' });
}

// GET /guestbook?before=<next>: ten notes, newest first, from where the last page ended (its
// `next`). Notes are ordered by when they were pinned plus a random fraction of a millisecond,
// so two pinned in the same millisecond still each land on one page.
async function list(req, res) {
  if (!store) return unavailable(res);
  const before = Number(req.query?.before);
  try {
    // one more than a page, to know whether there are older ones
    const notes = await store.page(Number.isFinite(before) && before > 0 ? before : Date.now() + 60_000, PAGE + 1);
    const more = notes.length > PAGE;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10');
    res.json({ notes: notes.slice(0, PAGE).map(shown), more, next: more ? Number(notes[PAGE - 1].order) : null });
  } catch (error) {
    console.error('Guestbook store error:', error);
    res.status(503).json({ error: 'The guestbook is unavailable' });
  }
}

// POST /guestbook { name, message, paper }
async function add(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store) return unavailable(res);
  if (!isPerson(req)) return res.status(403).json({ error: 'Only visitors can sign the guestbook' });
  const { name: rawName, message: rawMessage, paper: rawPaper } = req.body || {};
  const name = checkName(rawName, MAX_NAME);
  if (!name.ok) return res.status(422).json({ error: 'Pick another name', field: 'name', reason: name.reason });
  const message = checkMessage(rawMessage);
  if (!message.ok) return res.status(422).json({ error: 'That note can\'t go up', field: 'message', reason: message.reason });
  try {
    const who = visitorId(req);
    if ((await store.hit(`visitor:${who}`, DAY)) > PER_VISITOR) {
      return res.status(429).json({ error: 'That\'s your notes for today', scope: 'visitor' });
    }
    if ((await store.hit('everyone', DAY)) > PER_DAY) {
      return res.status(429).json({ error: 'The board is full for today', scope: 'everyone' });
    }
    if (await moderation.flagged(`${name.name}: ${message.message}`)) {
      return res.status(422).json({ error: 'That note can\'t go up', field: 'message', reason: 'words' });
    }
    const note = {
      id: crypto.randomBytes(9).toString('base64url'),
      name: name.name,
      message: message.message,
      at: Date.now(),
      // the paper the visitor wrote on, so it goes up as they saw it (any other: one at random)
      paper: Number.isInteger(rawPaper) && rawPaper >= 0 && rawPaper < PAPERS ? rawPaper : crypto.randomInt(PAPERS),
    };
    await store.add({ ...note, order: note.at + crypto.randomInt(1000) / 1000 });
    res.json({ note: shown(note) });
  } catch (error) {
    console.error('Guestbook store error:', error);
    res.status(503).json({ error: 'The guestbook is unavailable' });
  }
}

// DELETE /guestbook/:id with the X-Admin-Secret header: take a note down
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
    console.error('Guestbook store error:', error);
    res.status(503).json({ error: 'The guestbook is unavailable' });
  }
}

module.exports = { list, add, remove, PAGE, MAX_NAME, PER_VISITOR };
