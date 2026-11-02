const { Ratelimit } = require('@upstash/ratelimit');
const redis = require('../services/redis');

/**
 * Chat rate limiting
 * Each question costs two OpenAI calls, so this keeps the bill bounded: per visitor, a burst
 * limit and a daily one; for everyone together, a daily cap that holds however many addresses
 * a script uses. Counters live in Upstash Redis, shared by every serverless instance; without
 * it (not configured, down or slow) each instance counts on its own, which is looser but
 * never unlimited.
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LIMITS = [
  { name: 'burst', perVisitor: true, tokens: 10, ms: 10 * MINUTE, window: '10 m' },
  { name: 'daily', perVisitor: true, tokens: 50, ms: DAY, window: '1 d' },
  // The daily window starts at midnight UTC, so "come back tomorrow" holds
  { name: 'global', perVisitor: false, tokens: Number(process.env.CHAT_DAILY_CAP) || 300, ms: DAY, window: '1 d' },
];
// How long a request may wait on Redis before the instance's own counters decide instead
const REDIS_TIMEOUT_MS = 1000;

if (!redis) console.warn('Upstash Redis is not configured; chat rate limits are counted per instance');

const sharedLimiters = redis && Object.fromEntries(LIMITS.map((limit) => [limit.name, new Ratelimit({
  redis,
  prefix: `chat:${limit.name}`,
  limiter: limit.perVisitor
    ? Ratelimit.slidingWindow(limit.tokens, limit.window)
    : Ratelimit.fixedWindow(limit.tokens, limit.window),
  timeout: REDIS_TIMEOUT_MS,
})]));

// Per-instance fallback: fixed windows, aligned like Upstash's
const localCounts = new Map();
function limitLocally(limit, key, now = Date.now()) {
  if (localCounts.size > 10000) {
    for (const [k, entry] of localCounts) if (entry.reset <= now) localCounts.delete(k);
  }
  const reset = (Math.floor(now / limit.ms) + 1) * limit.ms;
  const id = `${limit.name}:${key}:${reset}`;
  const count = (localCounts.get(id)?.count || 0) + 1;
  localCounts.set(id, { count, reset });
  return { success: count <= limit.tokens, reset };
}

// After Redis fails, skip it for a while instead of making every check wait out the timeout
const REDIS_RETRY_MS = 30 * 1000;
let redisDownUntil = 0;

async function check(limit, key) {
  if (sharedLimiters && Date.now() >= redisDownUntil) {
    try {
      const result = await sharedLimiters[limit.name].limit(key);
      // On a timeout Upstash lets the request through; count it here instead
      if (result.reason !== 'timeout') return result;
      console.error('Rate limit store timed out');
    } catch (error) {
      console.error('Rate limit store error:', error);
    }
    redisDownUntil = Date.now() + REDIS_RETRY_MS;
  }
  return limitLocally(limit, key);
}

// The visitor's address. Vercel sets these headers itself, so they can't be spoofed there;
// anywhere else only the socket can be trusted.
function visitorIp(req) {
  if (process.env.VERCEL) {
    const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

async function chatRateLimit(req, res, next) {
  const ip = visitorIp(req);
  // In order, stopping at the first that refuses, so a blocked visitor doesn't use up the
  // shared daily allowance
  for (const limit of LIMITS) {
    const { success, reset } = await check(limit, limit.perVisitor ? ip : 'all');
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
        // `everyone`: the chatbot is resting for the day, not just for this visitor
        scope: limit.perVisitor ? 'visitor' : 'everyone',
        retryAfter,
      });
    }
  }
  next();
}

module.exports = { chatRateLimit, visitorIp, limitLocally, LIMITS };
