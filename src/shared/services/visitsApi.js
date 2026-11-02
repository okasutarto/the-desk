const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';
// Set once this tab has been counted, so a reload only reads (the API counts each person once
// anyway; this just spares it the write)
const COUNTED_FLAG = 'visit-counted';

let pending = null;

async function load() {
  let counted = false;
  try { counted = sessionStorage.getItem(COUNTED_FLAG) === '1'; } catch { /* Storage is optional. */ }
  // Only the live site counts; a local one just reads
  const count = process.env.NODE_ENV === 'production' && !counted;
  const res = await fetch(`${API_URL}/api/visits`, { method: count ? 'POST' : 'GET' });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const { total } = await res.json();
  if (count) try { sessionStorage.setItem(COUNTED_FLAG, '1'); } catch { /* Storage is optional. */ }
  return total ?? 0;
}

/**
 * How many people have come by, counting this one. The app asks as it starts (so both the
 * room and /2d count), and the Times Gate gets the same answer; a failure lets the next call
 * try again.
 * @returns {Promise<number>}
 */
export const getVisits = () => {
  if (!pending) {
    pending = load().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
};
