const { Redis } = require('@upstash/redis');

// Upstash Redis, shared by every serverless instance (chat rate limits, the visit count), or
// null when it isn't configured. Vercel's integration names the variables either way.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

module.exports = url && token ? new Redis({ url, token }) : null;
