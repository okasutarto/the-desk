/**
 * The name a player puts on their bounty: up to 12 characters, shown to everyone, so it's
 * tidied up and checked before it goes on the board. This is the first of two checks; the
 * second is OpenAI's moderation (see strikeController), which catches what a list can't.
 */

const MAX_NAME = 12;

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

/**
 * @param {unknown} raw
 * @returns {{ ok: true, name: string } | { ok: false, reason: 'empty' | 'long' | 'characters' | 'words' }}
 */
function checkName(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if ([...name].length > MAX_NAME) return { ok: false, reason: 'long' };
  if (!ALLOWED.test(name)) return { ok: false, reason: 'characters' };
  const read = plain(name);
  const squashed = read.replace(/[^a-z]/g, '');
  // repeated letters squeezed too, so "fuuuck" is still caught
  const squeezed = squashed.replace(/(.)\1+/g, '$1');
  const words = read.split(/[^a-z]+/).filter(Boolean);
  if (ANYWHERE.some((word) => squashed.includes(word) || squeezed.includes(word))) return { ok: false, reason: 'words' };
  if (words.some((word) => SHORT_WORDS.includes(word) || SHORT_WORDS.includes(word.replace(/(.)\1+/g, '$1')))) return { ok: false, reason: 'words' };
  return { ok: true, name };
}

module.exports = { checkName, MAX_NAME };
