import { BODY, DISPLAY, wrap } from "./base";

// ---------- the guestbook's papers, pinned to the cork board ----------
// Visitors' notes in a handwriting face on sticky-note colours, the card to write one on, and a
// tab to leaf back through older ones. Each is drawn from its slot's state, so a page of notes
// redraws the same papers.
const GUEST_HAND = "'Caveat', cursive";
const GUEST_INK = "#1a1714";
// The papers a note can be on (the server picks one, so everyone sees the same)
export const GUEST_PAPERS = ["#fff3a3", "#ffd1ec", "#c9f2e6", "#d7e6ff", "#ffe0c2", "#e6dcff"];
export const GUEST_NAME_MAX = 20;
export const GUEST_MESSAGE_MAX = 120;

function guestGrain(c, w, h, seed) {
  let r = seed * 9301 + 7;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (w * h) / 900; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.035)" : "rgba(255,255,255,.08)";
    c.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
  }
  const curl = c.createLinearGradient(w * 0.75, h * 0.75, w, h);
  curl.addColorStop(0, "rgba(0,0,0,0)");
  curl.addColorStop(1, "rgba(0,0,0,.14)");
  c.fillStyle = curl;
  c.fillRect(0, 0, w, h);
}

const guestSeed = (text) => [...String(text)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 9973, 17);

// A short date, as a visitor would scribble it
export function noteDate(at, now = Date.now()) {
  const days = Math.floor((now - at) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Wrapped, with any word too long for a line broken across lines (a visitor can type one
// unbroken run of letters)
function guestWrap(c, text, width, maxLines) {
  const words = String(text).split(" ").flatMap((word) => {
    if (c.measureText(word).width <= width) return [word];
    const parts = [];
    let part = "";
    for (const ch of word) {
      if (part && c.measureText(part + ch).width > width) {
        parts.push(part);
        part = ch;
      } else part += ch;
    }
    return part ? [...parts, part] : parts;
  });
  return wrap(c, words.join(" "), width, maxLines);
}

// The largest handwriting size (down to a floor) at which `text` fits `lines` lines of `width`
function guestFit(c, text, width, height, max, min) {
  for (let size = max; size >= min; size -= 1) {
    c.font = `600 ${size}px ${GUEST_HAND}`;
    const lines = guestWrap(c, text, width, 99);
    if (lines.length * size * 1.05 <= height) return { size, lines };
  }
  c.font = `600 ${min}px ${GUEST_HAND}`;
  return { size: min, lines: guestWrap(c, text, width, Math.max(1, Math.floor(height / (min * 1.05)))) };
}

// A visitor's note: their message in handwriting, signed with their name and when
function drawGuestNote(c, w, h, { note }) {
  c.fillStyle = GUEST_PAPERS[note.paper % GUEST_PAPERS.length] || GUEST_PAPERS[0];
  c.fillRect(0, 0, w, h);
  // a gummed strip along the top, as on a sticky note
  c.fillStyle = "rgba(0,0,0,.05)";
  c.fillRect(0, 0, w, h * 0.12);
  const pad = w * 0.08;
  c.textBaseline = "top";
  c.fillStyle = "#1e2a5a";
  const { size, lines } = guestFit(c, note.message, w - pad * 2, h * 0.6, Math.round(h * 0.2), Math.round(h * 0.1));
  lines.forEach((line, i) => c.fillText(line, pad, h * 0.17 + i * size * 1.05));
  c.textBaseline = "alphabetic";
  c.textAlign = "right";
  c.fillStyle = GUEST_INK;
  c.font = `600 ${Math.round(h * 0.15)}px ${GUEST_HAND}`;
  let sign = `— ${note.name}`;
  while (c.measureText(sign).width > w - pad * 2 && sign.length > 4) sign = `${sign.slice(0, -2)}…`;
  c.fillText(sign, w - pad, h * 0.86);
  c.fillStyle = "rgba(26,23,20,.55)";
  c.font = `700 ${Math.round(h * 0.07)}px ${BODY}`;
  c.fillText(noteDate(note.at), w - pad, h * 0.95);
  c.textAlign = "left";
  guestGrain(c, w, h, guestSeed(note.id));
}

// What a refused or failed note is told
const GUEST_REFUSED = {
  name: {
    empty: "Write your name first.",
    long: `Names are ${GUEST_NAME_MAX} letters at most.`,
    characters: "Letters, numbers and . _ - ' ! only.",
    words: "Try another name.",
  },
  message: {
    empty: "Write something first.",
    long: `${GUEST_MESSAGE_MAX} characters at most.`,
    characters: "Some of those characters can't go up.",
    link: "No links, please.",
    words: "That one can't go on the board.",
  },
};
export const refusalText = ({ field, reason, scope }) => {
  if (reason === "limit") return scope === "everyone" ? "The board's full for today." : "That's your notes for today.";
  if (reason === "offline") return "Couldn't reach the board. Try again?";
  return GUEST_REFUSED[field]?.[reason] || "That note can't go up.";
};

// The card to write on, on the paper its note will go up on: a prompt until it's tapped, then
// a name line and the note, with the caret in whichever is being typed
function drawGuestComposer(c, w, h, { compose }) {
  // on the paper the note will be pinned up on
  c.fillStyle = GUEST_PAPERS[compose.paper % GUEST_PAPERS.length] || GUEST_PAPERS[0];
  c.fillRect(0, 0, w, h);
  const pad = w * 0.07;
  c.textBaseline = "alphabetic";
  if (compose.state === "idle" || compose.state === "posted") {
    // the pad's top sheet, waiting
    c.fillStyle = GUEST_INK;
    c.font = `900 ${Math.round(h * 0.12)}px ${DISPLAY}`;
    c.fillText("SIGN THE BOOK", pad, h * 0.18);
    c.font = `600 ${Math.round(h * 0.17)}px ${GUEST_HAND}`;
    c.fillStyle = "#1e2a5a";
    const lines = compose.state === "posted" ? ["Pinned! Thanks for", "stopping by ♡"] : ["Leave a note for", "everyone who visits ✎"];
    lines.forEach((line, i) => c.fillText(line, pad, h * (0.45 + i * 0.18)));
    c.fillStyle = GUEST_INK;
    c.font = `800 ${Math.round(h * 0.075)}px ${BODY}`;
    c.fillText(compose.state === "posted" ? "TAP TO WRITE ANOTHER" : "TAP TO WRITE", pad, h * 0.9);
    guestGrain(c, w, h, 3);
    return;
  }
  // Being written: the sheet as the note will look, a gummed strip, a greeting, the words and
  // the signature, with only a whisper of what to do
  const caretOn = compose.caret;
  const sel = compose.sel;
  const layout = composerLayout(c, w, h, compose);
  c.fillStyle = "rgba(0,0,0,.05)";
  c.fillRect(0, 0, w, h * 0.12);
  c.fillStyle = "rgba(30,42,90,.5)";
  c.font = `600 ${Math.round(h * 0.085)}px ${GUEST_HAND}`;
  c.fillText("to everyone who visits,", pad, h * 0.25);
  c.textAlign = "right";
  c.fillStyle = "rgba(26,23,20,.4)";
  c.font = `700 ${Math.round(h * 0.045)}px ${BODY}`;
  c.fillText(`${[...(compose.message || "")].length}/${GUEST_MESSAGE_MAX}`, w - pad, h * 0.08);
  c.textAlign = "left";
  // no rules: the note and its signature, written straight on the paper
  const m = layout.message;
  const n = layout.name;
  c.fillStyle = "#1e2a5a";
  c.font = `600 ${n.size}px ${GUEST_HAND}`;
  c.textAlign = "right";
  c.fillText("— ", n.x, n.top);
  c.textAlign = "left";
  // a faint hint where nothing's written yet
  const hint = (f, text) => {
    if (f.text) return;
    c.fillStyle = "rgba(30,42,90,.28)";
    c.font = `600 ${f.size}px ${GUEST_HAND}`;
    c.fillText(text, f.x, f.top);
  };
  hint(m, "write something nice...");
  hint(n, "your name");
  // the words, with whatever's picked out behind them and the caret where it is
  const typed = (f, field) => {
    const { starts, first, shown, top, step, size, caretAt, caretLine, x } = f;
    const active = compose.field === field && sel;
    c.font = `600 ${size}px ${GUEST_HAND}`;
    shown.forEach((line, i) => {
      const at = starts[first + i];
      const y = top + i * step;
      if (active && sel.end > sel.start) {
        const a = Math.max(sel.start, at);
        const b = Math.min(sel.end, at + line.length);
        if (b > a) {
          c.fillStyle = "rgba(59,130,246,.32)";
          c.fillRect(x + c.measureText(line.slice(0, a - at)).width, y - size * 0.85, c.measureText(line.slice(a - at, b - at)).width, size * 1.05);
        }
      }
      c.fillStyle = "#1e2a5a";
      c.fillText(line, x, y);
      if (caretOn && active && first + i === caretLine) c.fillRect(x + c.measureText(line.slice(0, caretAt - at)).width + 1, y - size * 0.85, 2, size * 1.05);
    });
    if (caretOn && active && !shown.length) c.fillRect(x + 1, top - size * 0.85, 2, size * 1.05);
  };
  typed(m, "message");
  typed(n, "name");
  // what's happening, quietly; a refusal says why, in red
  const status = {
    typing: compose.field === "name" ? "enter to pin it" : compose.name ? "enter to pin it · tap your name to change it" : "enter to sign it",
    sending: "pinning it up...",
    refused: refusalText(compose),
  }[compose.state] || "";
  c.font = `700 ${Math.round(h * 0.048)}px ${BODY}`;
  c.fillStyle = compose.state === "refused" ? "#c81e3a" : "rgba(26,23,20,.45)";
  c.fillText(status, pad, h * 0.965);
  guestGrain(c, w, h, 3);
}

// Where the card's writing sits: each field's wrapped lines, where each starts in its text,
// the (up to) three shown round the caret, and where they start, their size and spacing. Shared by the
// drawing and by a tap or drag on the card, so both agree on where every letter is.
export function composerLayout(c, w, h, compose) {
  const pad = w * 0.07;
  const sel = compose.sel;
  const field = (name, text, x, top, step, size) => {
    c.font = `600 ${size}px ${GUEST_HAND}`;
    const lines = name === "name" ? (text ? [text] : []) : guestWrap(c, text, w - x - pad, 99);
    // where each wrapped line starts in the text (wrapping only drops the spaces it breaks at)
    let from = 0;
    const starts = lines.map((line) => {
      const at = text.indexOf(line, from);
      from = (at < 0 ? from : at) + line.length;
      return at < 0 ? from - line.length : at;
    });
    // the three lines round the caret while it's typed in, else the last three
    const caretAt = compose.field === name && sel ? sel.end : text.length;
    let caretLine = starts.findLastIndex((at) => at <= caretAt);
    if (caretLine < 0) caretLine = 0;
    const first = lines.length <= 3 ? 0 : Math.max(0, Math.min(caretLine - 2, lines.length - 3));
    return { text, lines, starts, first, shown: lines.slice(first, first + 3), x, top, step, size, caretAt, caretLine };
  };
  // the note in three lines, then the name signed at the foot, right of a dash and flush with
  // the right edge, as on a pinned note (the hint's width while it's unsigned)
  const nameSize = Math.round(h * 0.13);
  c.font = `600 ${nameSize}px ${GUEST_HAND}`;
  const signed = compose.name || "";
  const nameX = w - pad - c.measureText(signed || "your name").width;
  return {
    pad,
    message: field("message", compose.message || "", pad, h * 0.42, h * 0.14, Math.round(h * 0.115)),
    name: field("name", signed, nameX, h * 0.86, 0, nameSize),
  };
}

/**
 * The letter a point on the card falls by: { field, index }, the name on the signature line at
 * its foot and the note above it, `index` the gap between letters nearest the point.
 * @param {{ x: number, y: number }} uv the point on the card (0–1, y up)
 * @param {"name" | "message" | null} [only] the field to look in, whatever the height
 */
export function composerIndexAt(c, w, h, compose, uv, only = null) {
  const layout = composerLayout(c, w, h, compose);
  const py = (1 - uv.y) * h;
  // (`only` keeps a drag that strays into the other line in the one it began in)
  const name = only ? only === "name" : py > h * 0.77;
  const f = name ? layout.name : layout.message;
  const px = uv.x * w - f.x;
  if (!f.shown.length) return { field: name ? "name" : "message", index: 0 };
  const row = f.step ? Math.max(0, Math.min(f.shown.length - 1, Math.round((py - f.top + f.size * 0.35) / f.step))) : 0;
  const line = f.shown[row];
  c.font = `600 ${f.size}px ${GUEST_HAND}`;
  let best = 0;
  let gap = Infinity;
  for (let i = 0; i <= line.length; i++) {
    const off = Math.abs(c.measureText(line.slice(0, i)).width - px);
    if (off < gap) {
      gap = off;
      best = i;
    }
  }
  return { field: name ? "name" : "message", index: f.starts[f.first + row] + best };
}

// The tab for older notes, or back to the newest from the last page
function drawGuestPager(c, w, h, { pager }) {
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(59,130,246,.25)";
  c.lineWidth = 2;
  [0.45, 0.62, 0.79].forEach((k) => {
    c.beginPath();
    c.moveTo(0, h * k);
    c.lineTo(w, h * k);
    c.stroke();
  });
  const pad = w * 0.08;
  c.fillStyle = GUEST_INK;
  c.font = `900 ${Math.round(h * 0.12)}px ${DISPLAY}`;
  c.fillText(pager.more ? "OLDER NOTES" : "THE NEWEST", pad, h * 0.25);
  c.font = `600 ${Math.round(h * 0.2)}px ${GUEST_HAND}`;
  c.fillStyle = "#1e2a5a";
  c.fillText(pager.more ? "turn the page →" : "back to the top ↺", pad, h * 0.6);
  c.fillStyle = "rgba(26,23,20,.55)";
  c.font = `700 ${Math.round(h * 0.07)}px ${BODY}`;
  c.fillText(`PAGE ${pager.page}`, pad, h * 0.9);
  guestGrain(c, w, h, 11);
}

// A note of the board's own, while there's nothing else to show
function drawGuestPlaceholder(c, w, h, { text }) {
  c.fillStyle = "#fffdf5";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#1e2a5a";
  const pad = w * 0.08;
  c.textBaseline = "top";
  const { size, lines } = guestFit(c, text, w - pad * 2, h * 0.7, Math.round(h * 0.2), Math.round(h * 0.12));
  lines.forEach((line, i) => c.fillText(line, pad, h * 0.15 + i * size * 1.05));
  c.textBaseline = "alphabetic";
  guestGrain(c, w, h, 19);
}

/**
 * One paper on the guestbook, from its slot: { kind: "note", note } | { kind: "compose", compose }
 * | { kind: "pager", pager } | { kind: "placeholder", text }
 */
export function drawGuestPaper(c, w, h, slot) {
  if (!slot) return [];
  if (slot.kind === "note") drawGuestNote(c, w, h, slot);
  else if (slot.kind === "compose") drawGuestComposer(c, w, h, slot);
  else if (slot.kind === "pager") drawGuestPager(c, w, h, slot);
  else if (slot.kind === "placeholder") drawGuestPlaceholder(c, w, h, slot);
  return [];
}
