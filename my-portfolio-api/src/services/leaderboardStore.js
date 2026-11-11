const redis = require('./redis');

/**
 * Where Straw Hat Strike's bounties are kept: Upstash Redis, shared by every serverless
 * instance. Without it, a local server (not production) keeps them in memory so the game can
 * be tried end to end; production answers 503 instead, as the visit count does.
 *
 * Keys: `strike:top` is a sorted set of player ids by their best bounty, `strike:entry:<id>` a
 * hash of that best run, `strike:nonce:<n>` a spent run token and `strike:hits:*` rate counters.
 */

const TOP_KEY = 'strike:top';
const entryKey = (id) => `strike:entry:${id}`;
// Only the best hundred are kept; the board shows ten
const KEEP = 100;

function redisStore(client) {
  return {
    async best(id) {
      const score = await client.zscore(TOP_KEY, id);
      return score === null || score === undefined ? null : Number(score);
    },
    async save(id, entry) {
      await client.hset(entryKey(id), entry);
      await client.zadd(TOP_KEY, { score: entry.score, member: id });
      await client.zremrangebyrank(TOP_KEY, 0, -(KEEP + 1));
    },
    async rank(id) {
      const rank = await client.zrevrank(TOP_KEY, id);
      return rank === null || rank === undefined ? null : rank + 1;
    },
    async top(count) {
      const ids = await client.zrange(TOP_KEY, 0, count - 1, { rev: true });
      const entries = await Promise.all(ids.map((id) => client.hgetall(entryKey(id))));
      return ids.map((id, i) => ({ id, ...entries[i] })).filter((entry) => entry.name);
    },
    async remove(id) {
      const removed = await client.zrem(TOP_KEY, id);
      await client.del(entryKey(id));
      return removed > 0;
    },
    // True the first time a run token is spent; it's remembered as long as a token lives
    async spend(nonce, ttlSeconds) {
      return (await client.set(`strike:nonce:${nonce}`, 1, { nx: true, ex: ttlSeconds })) === 'OK';
    },
    // How many times `key` has been hit in this window, this one included
    async hit(key, windowSeconds) {
      const full = `strike:hits:${key}`;
      const count = await client.incr(full);
      if (count === 1) await client.expire(full, windowSeconds);
      return count;
    },
  };
}

function memoryStore() {
  const scores = new Map();
  const entries = new Map();
  const nonces = new Map();
  const hits = new Map();
  const ranked = () => [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return {
    async best(id) {
      return scores.has(id) ? scores.get(id) : null;
    },
    async save(id, entry) {
      entries.set(id, { ...entry });
      scores.set(id, Number(entry.score));
      ranked().slice(KEEP).forEach(([gone]) => scores.delete(gone));
    },
    async rank(id) {
      const i = ranked().findIndex(([one]) => one === id);
      return i < 0 ? null : i + 1;
    },
    async top(count) {
      return ranked().slice(0, count).map(([id]) => ({ id, ...entries.get(id) }));
    },
    async remove(id) {
      entries.delete(id);
      return scores.delete(id);
    },
    async spend(nonce, ttlSeconds) {
      const now = Date.now();
      if ((nonces.get(nonce) ?? 0) > now) return false;
      nonces.set(nonce, now + ttlSeconds * 1000);
      return true;
    },
    async hit(key, windowSeconds) {
      const now = Date.now();
      const slot = hits.get(key);
      if (!slot || slot.until <= now) {
        hits.set(key, { count: 1, until: now + windowSeconds * 1000 });
        return 1;
      }
      slot.count++;
      return slot.count;
    },
  };
}

function pickStore() {
  if (redis) return redisStore(redis);
  if (process.env.NODE_ENV === 'production') return null;
  console.warn('Upstash Redis is not configured; Straw Hat Strike bounties are kept in memory');
  return memoryStore();
}

module.exports = { store: pickStore(), redisStore, memoryStore, KEEP };
