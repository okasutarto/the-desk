/**
 * OpenAI's moderation (free to call) for text visitors put up: bounty names and guestbook
 * notes. True when it's flagged. Unreachable, or without a key, it lets the text through: the
 * word list has already run (utils/nameGuard), and anything can be taken down afterwards.
 */
let check = async (text) => {
  if (!process.env.OPENAI_API_KEY) return false;
  try {
    const { openai } = require('./openaiService');
    const result = await openai.moderations.create({ model: 'omni-moderation-latest', input: text });
    return Boolean(result.results?.[0]?.flagged);
  } catch (error) {
    console.error('Moderation unavailable:', error.message);
    return false;
  }
};

module.exports = {
  flagged: (text) => check(text),
  // for the checks: swap the call
  setModeration(fn) { check = fn; },
};
