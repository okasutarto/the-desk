const crypto = require('crypto');
const redis = require('../services/redis');
const { visitorIp } = require('../middleware/chatRateLimit');

// Everyone who has come by, once each: a set of keyed hashes of address and browser, so the
// count is exact and a reload, a new tab or a second visit adds nobody. The addresses
// themselves are never stored.
const VISITORS_KEY = 'visits:people';
// Without a configured secret the hashes are only unsalted, never per instance, so instances
// still agree on who has been counted
const VISITS_SECRET = process.env.VISITS_SECRET || '';
if (!VISITS_SECRET) console.warn('VISITS_SECRET is not set; visitor hashes are unsalted');

// Link previews, crawlers, audits and scripts load the page too, but nobody is looking
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|lighthouse|pagespeed|headless|phantom|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|curl|wget|python|axios|node-fetch|undici|go-http|java\//i;

function isPerson(req) {
  const agent = req.get('user-agent');
  return Boolean(agent) && !NOT_A_PERSON.test(agent);
}

function visitorId(req) {
  return crypto.createHmac('sha256', VISITS_SECRET)
    .update(`${visitorIp(req)}|${req.get('user-agent')}`)
    .digest('hex')
    .slice(0, 32);
}

// GET reads the count; POST counts the caller first (if they're a person) and then reads it
async function visits(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redis) return res.status(503).json({ error: 'Visit count is not configured' });
  try {
    if (req.method === 'POST' && isPerson(req)) await redis.sadd(VISITORS_KEY, visitorId(req));
    res.json({ total: await redis.scard(VISITORS_KEY) });
  } catch (error) {
    console.error('Visit count store error:', error);
    res.status(503).json({ error: 'Visit count is unavailable' });
  }
}

module.exports = { visits, isPerson, visitorId };
