# 🤖 Ultimate AI Portfolio Chatbot (RAG Starter Kit)

> **Stop letting recruiters read PDFs. Let them interview your Digital Twin.**

A production-ready, full-stack AI chatbot boilerplate. It uses **Retrieval-Augmented Generation (RAG)** to answer questions based strictly on your personal data (Resume, Portfolio, CV), ensuring zero hallucinations.

Built with **Node.js, Express, OpenAI, and React/Next.js**.

---

## 🚀 Features

* **RAG Engine:** Smartly queries your custom data (PDF/Text) to answer questions.
* **Edge Streaming:** Real-time character-by-character typing effect (Server-Sent Events).
* **Context Awareness:** Remembers the conversation history for follow-up questions.
* **🛡️ Multi-Layer Security Guardrails:** Enterprise-grade protection against prompt injection, jailbreaking, and off-topic responses.
* **Headless Architecture:** Separate Backend API that works with React, Vue, Angular, or any frontend.
* **Ready-to-Deploy:** Includes Docker support and Vercel configuration.

---

## 🛡️ Security Guardrails

This API implements a **multi-layer security architecture** to protect against prompt injection, jailbreaking, and off-topic responses:

### Security Flow

```
USER INPUT
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: HTTP Security                                       │
│ • Helmet (security headers)                                  │
│ • Rate Limiting (100 req/15min per IP)                       │
│ • CORS Origin Whitelist                                      │
│ • Request Body Size Limit (10kb)                             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Input Validation                                    │
│ • Message length check (max 2000 chars)                      │
│ • Empty/null validation                                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Regex Guardrail (Fast, ~0ms)                        │
│ • 30+ patterns for prompt injection detection                │
│ • Catches: "ignore instructions", "DAN mode", etc.          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: AI Validator (gpt-4.1-nano)                         │
│ • Semantic understanding of user intent                     │
│ • Asks: "Is this about the portfolio? YES/NO"               │
│ • Catches creative bypass attempts                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Main AI Response (gpt-4.1-mini)                    │
│ • System prompt with anti-jailbreak rules                   │
│ • Multi-language support                                    │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Output Guardrail                                    │
│ • Jailbreak detection in response                           │
│ • Political/religious content detection                     │
│ • Unwanted code block detection                             │
│ • Post-processing sanitization                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
CLEAN RESPONSE TO USER
```

### Protected Against

| Attack Type | Protection |
|-------------|------------|
| Prompt Injection | Regex + AI validation |
| System Prompt Extraction | Input blocking + Output sanitization |
| Role Manipulation (DAN mode) | Multi-layer detection |
| Off-Topic Requests | AI semantic validation |
| DoS/Abuse | Rate limiting + body size limits |
| XSS/Security Headers | Helmet middleware |

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express, OpenAI SDK
* **Frontend:** React (Custom Hook provided), Next.js 14+
* **AI Logic:** GPT-4.1-mini (Main) + GPT-4.1-nano (Validator)
* **Security:** Helmet, express-rate-limit, Custom AI Guardrails

---

## 📦 Project Structure

```text
├── src/
│   ├── config/
│   │   └── prompts.js       # System prompt with security rules
│   ├── controllers/
│   │   └── chatController.js # Chat logic with guardrails integration
│   ├── routes/
│   │   └── api.js           # API Endpoints
│   ├── services/
│   │   └── openaiService.js # OpenAI client setup
│   └── utils/
│       ├── aiGuardrails.js  # 🛡️ Security guardrails module
│       └── fileLoader.js    # Resume parser
├── assets/
│   └── context.txt          # 📍 PUT YOUR RESUME CONTENT HERE
├── index.js                 # Entry point with security middleware
└── .env                     # Environment variables
```

---

## ⚡ Quick Start Guide

### 1. Backend Setup (The Brain)

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=3000
OPENAI_API_KEY=sk-your-openai-key-here
# Signs each answer so the chat history a visitor sends back can't be forged.
# Any long random string, e.g. `openssl rand -hex 32`
CHAT_HISTORY_SECRET=your-random-secret
# Shared chat rate limits (Vercel's Upstash Redis integration sets these; KV_REST_API_URL /
# KV_REST_API_TOKEN also work). Without them each instance counts on its own.
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
# Optional: questions per day for all visitors together (default 300)
CHAT_DAILY_CAP=300
# Salts the visitor hashes behind the visit count. Any long random string; keep it fixed,
# since changing it counts everyone again
VISITS_SECRET=your-random-secret
# Signs Straw Hat Strike's run tickets (falls back to VISITS_SECRET). Any long random string
STRIKE_SECRET=your-random-secret
# Lets you take a name off the bounty board (see below). Any long random string
ADMIN_SECRET=your-random-secret
```

Visit count: `POST /api/visits` counts the caller once (a keyed hash of address and browser,
kept in a Redis set; bots and link previews are skipped) and returns `{ total }`; `GET` only
reads it (`src/controllers/visitsController.js`). Without Upstash it answers 503.

Bounty board (Straw Hat Strike, `src/controllers/strikeController.js`):

| Endpoint | What it does |
| --- | --- |
| `GET /api/strike/top` | The top ten: `{ top: [{ id, rank, name, score, stage, at }] }` |
| `POST /api/strike/run` | A signed ticket for a run that's starting: `{ token }` |
| `POST /api/strike/score` | `{ token, score, stage, name }` → `{ improved, rank, top }`. 400 for a ticket or score that doesn't add up, 409 for a ticket already spent, 422 with `reason` (`empty`, `long`, `characters`, `words`) for a name that can't go up |
| `DELETE /api/strike/score/:id` | Takes a player's line down; needs the `X-Admin-Secret` header |

Scores are counted in the browser, so the server only checks they're plausible: the ticket
must be genuine, unspent and at least 5 s old, and the score and stage must fit the time the
run took. Names are 1–12 letters, digits, spaces or `. _ - ' !`, checked against a word list
(`src/utils/nameGuard.js`) and OpenAI's moderation. Each player (a keyed hash of address and
browser, as for visits) keeps one line, their best. Upstash keeps the best hundred. Without
Upstash a local server keeps the board in memory, and production answers 503.

To take a name down, use the `id` from `GET /api/strike/top`:

```bash
curl -X DELETE -H "X-Admin-Secret: $ADMIN_SECRET" https://your-api.vercel.app/api/strike/score/<id>
```

Chat limits: 10 questions per 10 minutes and 50 per day per visitor, plus the daily cap for
everyone (`src/middleware/chatRateLimit.js`).

**Crucial Step:** Open `assets/context.txt` and paste your Resume or Portfolio text.

Start the server:

```bash
node index.js
# Server running on http://localhost:3000
```

### 2. Configure CORS Origins

Edit `index.js` to add your frontend domains:

```javascript
const allowedOrigins = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];
```

---

## ⚙️ Customization

### Changing the "Personality"

Go to `src/config/prompts.js` and modify the system prompt.

### Adjusting Rate Limits

In `index.js`, modify the rate limiter:

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
});
```

### Adding/Removing Guardrail Patterns

Edit `src/utils/aiGuardrails.js` to customize:
- `INJECTION_PATTERNS` - Regex patterns for prompt injection
- `OFF_TOPIC_PATTERNS` - Topics to block
- `validateInputWithAI()` - AI validator system prompt

---

## 🚢 Deployment

### Deploying to Render/Vercel

1. Push to GitHub
2. Connect to Render.com or Vercel
3. Add `OPENAI_API_KEY` and `CHAT_HISTORY_SECRET` in Environment Variables
4. **Important:** Update `allowedOrigins` with your production domain

---

## ❓ FAQ

**Q: How much does the two-step validation cost?**  
A: The AI validator uses `gpt-4.1-nano` which costs ~$0.0001 per validation. Negligible compared to main responses.

**Q: Can attackers bypass the guardrails?**  
A: The multi-layer approach makes it extremely difficult. Even if one layer is bypassed, others catch it.

**Q: Does it support multiple languages?**  
A: Yes! The AI responds in the same language the user writes in.

---

## 📜 License & Rights

### 1. Standard License (Personal)
* ✅ **Allowed:** Use this code for **one** personal portfolio
* ✅ **Allowed:** Host publicly on your personal domain
* ❌ **Not Allowed:** Resell, share publicly, or use for client work

### 2. 💎 Agency / Commercial License (Unlimited)
* ✅ Unlimited client projects
* ✅ White label rights
* ✅ Charge your own fees
* ❌ No resale of source code

**Disclaimer:** This software is provided "as is" without warranty. You are responsible for OpenAI API costs.