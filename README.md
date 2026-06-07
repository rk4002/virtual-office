# VirtualOffice

2D spatial audio virtual office — walk around a shared office floor, talk to colleagues with proximity-based audio, and see who's online. Built for the 2care4 pilot (15 users).

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      VirtualOffice                         │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐ │
│  │   Next.js 15      │    │        Vercel Cloud          │ │
│  │   App Router      │    │                              │ │
│  │                   │    │  ┌──────────┐ ┌───────────┐ │ │
│  │  ┌─────────────┐  │    │  │  Vercel   │ │  LiveKit  │ │ │
│  │  │ Client       │  │    │  │  Postgres │ │  Cloud    │ │ │
│  │  │  OfficeCanvas │  │    │  │           │ │           │ │ │
│  │  │  ChatPanel   │  │    │  │ • layouts │ │ • WebRTC  │ │ │
│  │  │  PresencePanel│  │    │  │ • presence│ │ • audio   │ │ │
│  │  │  ChatBubbles │  │    │  │ • chat    │ │ • data    │ │ │
│  │  └──────┬───────┘  │    │  │   messages│ │   channel │ │ │
│  │         │          │    │  └──────────┘ └───────────┘ │ │
│  │  ┌──────┴───────┐  │    │                              │ │
│  │  │ Hooks         │  │    │  ┌──────────────────────┐  │ │
│  │  │  useLiveKit   │  │    │  │    Azure AD (Entra)  │  │ │
│  │  │   Room        │──┼────┼──│    OIDC SSO          │  │ │
│  │  │  usePresence  │──┼────┼──│    via NextAuth.js   │  │ │
│  │  │  useChat      │──┼────┼──│    (2care4 M365)     │  │ │
│  │  └──────────────┘  │    │  └──────────────────────┘  │ │
│  │         │          │    │                              │ │
│  │  ┌──────┴───────┐  │    └──────────────────────────────┘ │
│  │  │ API Routes    │  │                                     │
│  │  │  /api/livekit/ │  │                                     │
│  │  │   token       │──┤                                     │
│  │  │  /api/presence │──┤                                     │
│  │  │  /api/chat    │──┤                                     │
│  │  │  /api/layouts │──┤                                     │
│  │  │  /api/auth/   │──┤                                     │
│  │  │   [...nextauth]│ │                                     │
│  │  └──────────────┘  │                                     │
│  │         │          │                                     │
│  │  ┌──────┴───────┐  │                                     │
│  │  │ Lib           │  │                                     │
│  │  │  spatial-     │  │                                     │
│  │  │   audio-engine│  │                                     │
│  │  │  office-layout│  │                                     │
│  │  │  db           │  │                                     │
│  │  │  auth         │  │                                     │
│  │  └──────────────┘  │                                     │
│  └──────────────────┘                                        │
└────────────────────────────────────────────────────────────┘
```

### How the pieces connect

| Layer              | Technology                    | Purpose                                               |
|--------------------|-------------------------------|-------------------------------------------------------|
| **Frontend**       | Next.js 15 App Router, React 19, Tailwind CSS 4, TypeScript 5 | Server-rendered pages + client-side canvas |
| **Auth**           | NextAuth.js v5 + Microsoft Entra ID (Azure AD) OIDC  | SSO with 2care4 M365 accounts                         |
| **Real-time audio**| LiveKit Cloud (WebRTC)        | Spatial audio: proximity-based volume/pan             |
| **Presence**       | SSE + Vercel Postgres         | Who's online, where they are, heartbeat-based liveness|
| **Chat**           | SSE + Vercel Postgres         | Room-scoped + private DMs, auto-expiring messages     |
| **Persistence**    | Vercel Postgres               | Layouts, presence, chat messages                      |
| **Deployment**     | Vercel (arn1 / Stockholm)     | Serverless hosting with cron jobs                     |

### Spatial audio engine

Custom Web Audio API engine (not using LiveKit's built-in spatialization):

- **Inverse-square falloff**: Near-field plateau at 40px, silence at 400px
- **Zone-gated mixing**: Same-room full volume, focus rooms silence, social zones boosted, open-plan falloff
- **Stereo panning**: Equal-power pan law based on horizontal offset
- **Conversation bonus**: +1.4x gain within 60px radius
- **Capped simultaneity**: Maximum 20 simultaneous voices, lowest-gain culled
- **Smooth transitions**: Gain changes use exponential smoothing (τ ≈ 80ms)

### SSE-based systems

Both presence and chat use Server-Sent Events with polling loops (not WebSockets):

- Designed for Vercel serverless (Edge-compatible via `ReadableStream`)
- 2-second poll interval for presence, 1.5-second for chat
- Differential updates: only pushes when data changes, keepalive comments otherwise
- Chat messages auto-expire after 5 minutes (TTL enforced server-side)
- Presence users go stale after 15 seconds without heartbeat

## Directory structure

```
virtual-office/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Geist fonts, metadata)
│   │   ├── page.tsx               # Main office — join form + office canvas
│   │   ├── globals.css            # Tailwind v4
│   │   ├── login/page.tsx         # Azure AD sign-in page
│   │   ├── editor/page.tsx        # Layout editor (standalone)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth.js handler
│   │       ├── livekit/token/route.ts       # POST: generate LiveKit JWT
│   │       ├── presence/route.ts            # POST: heartbeat / GET: SSE stream
│   │       ├── chat/route.ts                # POST: send / GET: SSE stream
│   │       └── layouts/route.ts             # CRUD for office layouts
│   ├── components/
│   │   ├── OfficeCanvas.tsx       # 2D canvas renderer (rooms, avatars, chat bubbles)
│   │   ├── ChatPanel.tsx          # Chat sidebar (room messages + private DMs)
│   │   ├── ChatBubbleOverlay.tsx  # Floating speech bubbles on the canvas
│   │   ├── PresencePanel.tsx      # Online user list sidebar
│   │   └── LayoutEditor.tsx       # Drag-and-drop office layout designer
│   ├── hooks/
│   │   ├── useLiveKitRoom.ts      # LiveKit connection + game loop + spatial audio
│   │   ├── usePresence.ts         # SSE presence subscription + heartbeat
│   │   └── useChat.ts             # SSE chat subscription + send function
│   ├── lib/
│   │   ├── spatial-audio-engine.ts # Web Audio API: falloff, panning, mix
│   │   ├── office-layout.ts       # Constants, room definitions, collision
│   │   ├── db.ts                  # Vercel Postgres client + schema + CRUD
│   │   ├── auth.ts                # NextAuth.js config (Azure AD provider)
│   │   └── layout-editor-types.ts # Type definitions for layout editor
│   └── middleware.ts              # Auth guard: redirect unauthenticated → /login
├── e2e/                           # Playwright end-to-end tests
├── prototype-archive/             # Original prototype HTML + docs
├── package.json
├── tsconfig.json
├── next.config.ts
├── playwright.config.ts
├── vercel.json                    # Vercel deployment config (prototype-archive/)
├── DEPLOY.md                      # Deployment guide (separate)
├── .env.example                   # Environment variable template
└── .env.local                     # Local environment variables (gitignored)
```

## Setup

### Prerequisites

- Node.js 20+
- npm (or pnpm/yarn/bun)
- A LiveKit Cloud project (free tier works for up to 50 concurrent sessions)
- A Vercel Postgres database
- An Azure AD application registration (for 2care4 SSO)

### 1. Clone and install

```bash
git clone https://github.com/rk4002/virtual-office.git
cd virtual-office
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
# Generated with: openssl rand -hex 32
NEXTAUTH_SECRET=your-secret-here

# Azure AD / Microsoft Entra ID (SSO with 2care4 M365)
AUTH_MICROSOFT_ENTRA_ID_ID=your-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your-client-secret
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0

# NextAuth (auto-detected in dev, required in production)
NEXTAUTH_URL=http://localhost:3000

# LiveKit Cloud — spatial audio
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud

# Vercel Postgres (auto-injected by Vercel in production)
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

### 3. Set up the database

Tables are created automatically on first API call (idempotent `CREATE TABLE IF NOT EXISTS`). No migration runner needed — just start the dev server and hit any API endpoint.

### 4. Start developing

```bash
npm run dev
```

Open http://localhost:3000. You'll see the join screen. Enter a name and click "Gå til kontoret".

## Development workflow

| Command             | What it does                                   |
|---------------------|------------------------------------------------|
| `npm run dev`        | Start Next.js dev server (HMR, Turbopack)     |
| `npm run build`      | Production build                                |
| `npm run start`      | Start production server                         |
| `npm run lint`       | Run ESLint                                      |
| `npm run test:e2e`   | Run Playwright tests (against localhost:3000)   |
| `npm run test:e2e:ui`| Playwright in UI mode                           |

### Key architecture decisions

- **LiveKit over custom WebRTC**: LiveKit provides SFU, token auth, room management, and STUN/TURN out of the box. A custom WebRTC mesh would have required signaling server, ICE negotiation, and didn't scale beyond 4-5 peers. [ADR →](./docs/adr/001-livekit-vs-custom-webrtc.md)

- **SSE over WebSockets for presence/chat**: Vercel serverless functions don't support persistent WebSocket connections natively. SSE with `ReadableStream` + polling works on the Edge runtime and auto-reconnects on connection loss. [ADR →](./docs/adr/002-sse-vs-polling.md)

- **Next.js 15 App Router over Pages Router**: React Server Components, streaming, `layout.tsx` nesting, and route handlers co-located with pages. Pages Router is in maintenance mode; App Router is the forward path. [ADR →](./docs/adr/003-nextjs-15-app-router.md)

### Performance

This project uses lazy loading for heavy dependencies:

- `livekit-client` (~400KB) is only loaded after the user clicks "Gå til kontoret"
- `@livekit/components-react` (~172KB) is loaded via `next/dynamic` with `ssr: false`
- Initial page JavaScript: ~50KB (vs 134KB without lazy loading)

## Deployment (Vercel)

The project is configured for Vercel deployment in the `arn1` (Stockholm) region.

### Automated deployment

Once `VERCEL_TOKEN` is configured, the kanban pipeline handles everything:

```bash
vercel link --repo rk4002/virtual-office
vercel --prod
```

### Manual deployment

1. Push to GitHub
2. Connect repo to Vercel at https://vercel.com/new
3. Set all environment variables in Vercel dashboard (see `.env.example` for the full list)
4. Vercel auto-deploys on push to `main`

### Planned cron jobs (requires Vercel Pro)

| Path                        | Schedule        | Purpose                       |
|-----------------------------|-----------------|-------------------------------|
| `/api/cron/presence-cleanup`| Every 5 min     | Clear stale presence data     |

Note: Presence cleanup is currently handled inline in `getOnlineUsers()` (marks stale >15s offline). A dedicated cron endpoint is planned for production to reduce per-request overhead.

### Environment variables in production

Each of these must be set in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | JWT encryption key (generate: `openssl rand -hex 32`) |
| `NEXTAUTH_URL` | Yes (prod) | Canonical URL (e.g. `https://virtual-office.vercel.app`) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Yes | Azure AD application (client) ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Yes | Azure AD client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Yes | `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| `LIVEKIT_API_KEY` | Yes | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | Yes | LiveKit Cloud API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | Yes | WebSocket URL (e.g. `wss://my-project.livekit.cloud`) |
| `POSTGRES_URL` | Yes | Vercel Postgres connection string (auto-injected by Vercel integration) |
| `POSTGRES_URL_NON_POOLING` | Yes | Non-pooling variant (for SSE long-lived connections) |

See [DEPLOY.md](./DEPLOY.md) for the full deployment guide.

## API documentation

Full API docs are in [docs/api/README.md](./docs/api/README.md). Summary:

| Endpoint                     | Method | Purpose                            |
|------------------------------|--------|------------------------------------|
| `/api/auth/[...nextauth]`    | GET/POST | NextAuth.js handler (Azure AD) |
| `/api/livekit/token`         | POST   | Generate LiveKit JWT for room join |
| `/api/presence`              | POST   | Heartbeat (update position)        |
| `/api/presence`              | GET    | SSE stream of online users         |
| `/api/chat`                  | POST   | Send chat message                  |
| `/api/chat`                  | GET    | SSE stream of chat messages        |
| `/api/layouts`               | GET    | List / get single layout           |
| `/api/layouts`               | POST   | Create new layout                  |
| `/api/layouts`               | PUT    | Update layout                      |
| `/api/layouts`               | DELETE | Delete layout                      |

## Architecture Decision Records (ADR)

- [ADR-001: LiveKit vs Custom WebRTC](./docs/adr/001-livekit-vs-custom-webrtc.md)
- [ADR-002: SSE vs Polling for Presence/Chat](./docs/adr/002-sse-vs-polling.md)
- [ADR-003: Next.js 15 App Router vs Pages Router](./docs/adr/003-nextjs-15-app-router.md)

## Tech stack

| Category       | Technology                                |
|----------------|-------------------------------------------|
| Framework      | Next.js 15 (App Router)                   |
| Language       | TypeScript 5                              |
| UI             | React 19, Tailwind CSS 4                  |
| Auth           | NextAuth.js v5 + Azure AD (Microsoft Entra ID) |
| Real-time      | LiveKit Cloud (WebRTC SFU)                |
| Database       | Vercel Postgres                           |
| Testing        | Playwright                                |
| Linting        | ESLint 9                                  |
| Hosting        | Vercel                                    |

## License

Private — 2care4 pilot. Not for redistribution.