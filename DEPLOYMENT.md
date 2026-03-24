# NOEMA — Deployment Guide

## Quick Start (Local Dev)

```bash
npm run dev
# → http://localhost:3000
```

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "feat: NOEMA v0.2.0 — N.O.E engine"
git remote add origin https://github.com/<you>/noema.git
git push -u origin main
```

### 2. Import on Vercel
- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repo
- Framework: **Next.js** (auto-detected)
- Root directory: `.` (default)

### 3. Set Environment Variables on Vercel
In your Vercel project → Settings → Environment Variables:

| Key | Value | Required |
|-----|-------|----------|
| `GROQ_API_KEY` | `gsk_...` | Yes |
| `SOLANA_RPC_URL` | `https://mainnet.helius-rpc.com/?api-key=...` | Recommended |
| `HELIUS_WEBHOOK_SECRET` | `<webhook-secret>` | Recommended |
| `UPSTASH_REDIS_REST_URL` | `https://<id>.upstash.io` | Recommended |
| `UPSTASH_REDIS_REST_TOKEN` | `<token>` | Recommended |
| `NOE_PROTOCOL_SECRET` | `<strong-random-value>` | Recommended |
| `NOE_ANCHOR_KEYPAIR` | `[<json-array>]` | Optional |
| `NOE_PROGRAM_ID` | `<program-id>` | Optional |
| `NOE_IMAGE_PROVIDER` | `mock` \| `openai` \| `replicate` | Yes |
| `OPENAI_API_KEY` | `sk-...` | If using OpenAI |
| `REPLICATE_API_TOKEN` | `r8_...` | If using Replicate |

### 4. Deploy
Click **Deploy**. Done. Vercel handles everything.

---

## Local Desktop App (Electron)

### Development mode (hot reload)
```bash
npm run app:dev
```
This starts Next.js dev server + Electron simultaneously.

### Build distributable
```bash
# Current platform
npm run app:dist

# Windows installer (.exe)
npm run app:dist:win

# macOS (.dmg)
npm run app:dist:mac

# Linux (.AppImage)
npm run app:dist:linux
```

Output goes to `dist-electron/`.

---

## Image Generation Setup

### Option A: Mock (default, no API key)
Works out of the box. Returns SVG placeholders.
```env
NOE_IMAGE_PROVIDER=mock
```

### Option B: OpenAI DALL-E 3
```env
NOE_IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
```
Cost: ~$0.04 per image (standard quality, 1024×1024)

### Option C: Replicate SDXL
```env
NOE_IMAGE_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_...
```
Cost: ~$0.003 per image

---

## Architecture

```
NOEMA/
├── app/
│   ├── page.tsx                    # Landing page
│   └── api/
│       └── noe/
│           ├── route.ts            # Engine state API (GET/POST)
│           ├── chat/route.ts       # Streaming LLM chat
│           ├── wallet/route.ts     # On-chain tx polling + wallet connect
│           ├── webhook/route.ts    # Helius real-time tx receiver
│           ├── state/route.ts      # Public CORS-open state read
│           ├── image/route.ts      # Image generation
│           └── protocol/
│               ├── challenge/route.ts  # Agent handshake step 1
│               ├── verify/route.ts     # Agent handshake step 2
│               └── grant/route.ts      # Authenticated agent messaging
├── components/
│   ├── NoeAvatar.tsx               # Animated orb with particle system
│   ├── NoeChat.tsx                 # Personality-driven streaming chat
│   ├── NoeVisualizer.tsx           # Topographic consciousness map
│   ├── NoeStateMatrix.tsx          # 5-axis state vector display + DQN row
│   ├── NetworkPulse.tsx            # Live signal bars + memory narrative
│   ├── WalletButton.tsx            # Phantom connect button
│   └── WalletPanel.tsx             # Transaction feed + balances
├── lib/
│   ├── noe-state.ts                # UI state bridge + mood/color maps
│   ├── noe-llm.ts                  # Groq streaming + wallet context
│   ├── noe-image-prompt.ts         # State → visual prompt builder
│   ├── persistence.ts              # Upstash Redis KV layer
│   ├── noe-anchor.ts               # On-chain state anchoring
│   ├── noe-protocol/
│   │   └── index.ts                # Agent protocol types + HMAC auth
│   └── noe-engine/
│       ├── neural.ts               # 4-layer neural net + Hebbian learning
│       ├── cognition.ts            # Pattern clustering + meaning engine
│       ├── engine.ts               # Unified processing pipeline
│       ├── memory.ts               # Short/long-term memory
│       ├── personality.ts          # State-driven voice + expression
│       └── types.ts                # Core type definitions
├── docs/                           # Full documentation suite
├── electron/
│   └── main.js                     # Electron main process
├── vercel.json                     # Vercel deployment config
└── .env.example                    # Environment variable template
```
