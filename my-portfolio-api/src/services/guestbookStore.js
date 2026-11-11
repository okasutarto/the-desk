const redis = require('./redis');

/**
 * Where the guestbook's notes are kept: Upstash Redis, shared by every serverless instance.
 * Without it a local server (not production) keeps them in memory, so the board can be tried
 * end to end; production answers 503 instead, as the visit count does.
 *
 * Keys: `guestbook:notes` is a sorted set of note ids by their `order` (when they were pinned,
 * plus a random fraction of a millisecond to keep ties apart),
 * `guestbook:note:<id>` a hash of the note, and `guestbook:hits:*` rate counters.
 */

const NOTES_KEY = 'guestbook:notes';
const noteKey = (id) => `guestbook:note:${id}`;

function redisStore(client) {
  return {
    async add(note) {
      await client.hset(noteKey(note.id), note);
      await client.zadd(NOTES_KEY, { score: note.order, member: note.id });
    },
    // Newest first, ordered strictly before `before` (a note's `order`), `count` of them
    async page(before, count) {
      const ids = await client.zrange(NOTES_KEY, `(${before}`, '-inf', { byScore: true, rev: true, offset: 0, count });
      const notes = await Promise.all(ids.map((id) => client.hgetall(noteKey(id))));
      return notes.filter((note) => note && note.id);
    },
    async remove(id) {
      const removed = await client.zrem(NOTES_KEY, id);
      await client.del(noteKey(id));
      return removed > 0;
    },
    async hit(key, windowSeconds) {
      const full = `guestbook:hits:${key}`;
      const count = await client.incr(full);
      if (count === 1) await client.expire(full, windowSeconds);
      return count;
    },
  };
}

function memoryStore() {
  const notes = new Map();
  const hits = new Map();
  return {
    async add(note) {
      notes.set(note.id, { ...note });
    },
    async page(before, count) {
      return [...notes.values()].filter((note) => note.order < before).sort((a, b) => b.order - a.order).slice(0, count);
    },
    async remove(id) {
      return notes.delete(id);
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
  console.warn('Upstash Redis is not configured; the guestbook is kept in memory');
  return memoryStore();
}

module.exports = { store: pickStore(), redisStore, memoryStore };
