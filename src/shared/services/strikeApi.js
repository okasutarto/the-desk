// Straw Hat Strike's bounty board (my-portfolio-api, /api/strike/*). Every call settles: a
// failure comes back as { ok: false } rather than throwing, so the game carries on without it.
const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';

async function call(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`${API_URL}/api/strike/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, reason: data.reason || 'offline' };
  } catch {
    return { ok: false, status: 0, reason: 'offline' };
  }
}

/** The top ten: [{ id, rank, name, score, stage, at }] */
export const getBoard = () => call('top');

/** A signed ticket for the run that's starting */
export const startRun = () => call('run', { method: 'POST' });

/**
 * Post a finished run. Resolves { ok, improved, rank, top } or { ok: false, reason }, where
 * reason is 'empty' | 'long' | 'characters' | 'words' (the name), 'token' | 'score' (the run)
 * or 'offline'.
 */
export const postScore = ({ token, score, stage, name }) => call('score', { method: 'POST', body: { token, score, stage, name } });
