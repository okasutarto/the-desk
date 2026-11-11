/**
 * Text visitors put up for everyone to see: a name on a bounty (12 characters) or in the
 * guestbook (20), and a guestbook note (120). It's tidied up and checked here first; the
 * second check is OpenAI's moderation (services/moderation), which catches what a list can't.
 */

const MAX_NAME = 12;
const MAX_MESSAGE = 120;

// Letters and digits in any script, spaces and a little punctuation; no links, no emoji
const ALLOWED = /^[\p{L}\p{N} ._\-'!]+$/u;

// Whole words only for the short ones, which otherwise turn up inside harmless names (asu in
// "Yasuo", babi in "babies"); the longer ones are caught anywhere in the name
const SHORT_WORDS = ['asu', 'babi', 'tai', 'jembut', 'pepek', 'perek', 'fag', 'nazi', 'cum', 'tits', 'dick', 'cock', 'porn', 'rape', 'kkk'];
const ANYWHERE = [
  'anjing', 'anjeng', 'bangsat', 'kontol', 'memek', 'ngentot', 'entot', 'jancok', 'jancuk', 'goblok', 'tolol',
  'bajingan', 'lonte', 'pelacur', 'keparat', 'brengsek', 'tetek', 'puki', 'pantek', 'kimak',
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigg', 'nigga', 'whore', 'slut', 'faggot', 'retard', 'asshole', 'bastard', 'hitler',
];

// What a name reads as once dressed-up letters are undone: 4nj1ng is anjing, $h!t is shit
const LEET = { 4: 'a', '@': 'a', 3: 'e', 1: 'i', '!': 'i', 0: 'o', 5: 's', $: 's', 7: 't', 8: 'b', 9: 'g' };
const plain = (text) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[4@3!10$5789]/g, (ch) => LEET[ch]);

// True when the text holds a word on the lists, however it's dressed up
function hasBadWords(text) {
  const read = plain(text);
  const squashed = read.replace(/[^a-z]/g, '');
  // repeated letters squeezed too, so "fuuuck" is still caught
  const squeezed = squashed.replace(/(.)\1+/g, '$1');
  if (ANYWHERE.some((word) => squashed.includes(word) || squeezed.includes(word))) return true;
  const words = read.split(/[^a-z]+/).filter(Boolean);
  return words.some((word) => SHORT_WORDS.includes(word) || SHORT_WORDS.includes(word.replace(/(.)\1+/g, '$1')));
}

/**
 * @param {unknown} raw
 * @param {number} [max] characters at most (12 on a bounty, 20 in the guestbook)
 * @returns {{ ok: true, name: string } | { ok: false, reason: 'empty' | 'long' | 'characters' | 'words' }}
 */
function checkName(raw, max = MAX_NAME) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if ([...name].length > max) return { ok: false, reason: 'long' };
  if (!ALLOWED.test(name)) return { ok: false, reason: 'characters' };
  if (hasBadWords(name)) return { ok: false, reason: 'words' };
  return { ok: true, name };
}

// A link in any of its disguises: a scheme, www., or a bare domain like nama.com, bit.ly or
// slot88 (dot) com (but not "Halo. Com on", where the dot ends a sentence)
const LINK = /(\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]{2,}(\.|\s?\(dot\)\s?|\s?\[dot\]\s?)(com|net|org|io|id|co|me|xyz|ly|gg|app|dev|info|biz|site|online|link|shop|tv|us|uk|ru|cn)\b)/i;
// Control characters and the invisible ones that hide text or flip it backwards
const HIDDEN = /[\p{Cc}\p{Cf}]/u;

/**
 * A guestbook note: up to 120 characters on one line, any script, emoji welcome, no links.
 * @param {unknown} raw
 * @returns {{ ok: true, message: string } | { ok: false, reason: 'empty' | 'long' | 'characters' | 'link' | 'words' }}
 */
function checkMessage(raw, max = MAX_MESSAGE) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const message = raw.normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  // letters or digits somewhere: not just spaces, dots or emoji
  if (!/[\p{L}\p{N}]/u.test(message)) return { ok: false, reason: 'empty' };
  if ([...message].length > max) return { ok: false, reason: 'long' };
  if (HIDDEN.test(message.replace(/\u200d|\ufe0f/g, ''))) return { ok: false, reason: 'characters' };
  if (LINK.test(message)) return { ok: false, reason: 'link' };
  if (hasBadWords(message)) return { ok: false, reason: 'words' };
  return { ok: true, message };
}

module.exports = { checkName, checkMessage, hasBadWords, MAX_NAME, MAX_MESSAGE };
