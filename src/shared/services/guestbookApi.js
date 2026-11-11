// The guestbook on the room's cork board (my-portfolio-api, /api/guestbook). Every call
// settles: a failure comes back as { ok: false } rather than throwing, so the board just says so.
const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

async function call(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`${API_URL}/api/guestbook${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, ...data };
    return { ok: false, status: res.status, field: data.field, reason: res.status === 429 ? 'limit' : data.reason || 'offline', scope: data.scope };
  } catch {
    return { ok: false, status: 0, reason: 'offline' };
  }
}

/** Ten notes, newest first, from where a page ended (its `next`): { notes, more, next } */
export const getNotes = (before) => call(before ? `?before=${encodeURIComponent(before)}` : '');

/**
 * Pin a note, on the paper it was written on (0–5). Resolves { ok, note } or { ok: false, field, reason, scope }, where field is
 * 'name' or 'message' and reason 'empty' | 'long' | 'characters' | 'link' | 'words', or reason
 * is 'limit' (scope 'visitor' or 'everyone') or 'offline'.
 */
export const postNote = ({ name, message, paper }) => call('', { method: 'POST', body: { name, message, paper } });
