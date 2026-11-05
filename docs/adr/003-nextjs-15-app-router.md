# ADR-003: Next.js 15 App Router vs Pages Router

**Status**: Accepted  
**Date**: 2026-06-05  
**Deciders**: Rasmus (2care4)

> **Note (nov. 2026):** Beslutningen blev truffet, da piloten var planlagt hos 2care4. Projektet fortsætter nu hos Nicehair (Rasmus er Head of IT & Business Excellence). Beslutningen står uændret; referencer til 2care4 nedenfor er historiske.


## Context

VirtualOffice needs a web framework for rendering the 2D office canvas, handling API routes, managing authentication, and serving static assets. Two routing architectures in Next.js were evaluated:

1. **Pages Router** (`pages/` directory) — The traditional Next.js routing system (stable since Next.js 1.0)
2. **App Router** (`app/` directory) — The newer routing system introduced in Next.js 13, stable since Next.js 14

## Decision

**We chose Next.js 15 App Router** with React Server Components (RSC), Route Handlers, and Streaming SSR.

Key usages:
- **Route Handlers** (`route.ts`) for API endpoints — replaces `pages/api/*.ts` with cleaner API
- **Server Components** for the login page (renders on server, no client JS for auth page)
- **Client Components** (`"use client"`) for interactive office canvas — marked explicitly
- **Middleware** (`middleware.ts`) for auth guarding at the edge
- **Dynamic imports** (`next/dynamic`) for lazy-loading heavy dependencies (LiveKit SDK ~400KB)
- **Streaming SSE** via `ReadableStream` in Route Handlers (presence and chat APIs)

## Alternatives Considered

### Pages Router

**Pros:**
- Mature and stable — well-documented, extensive community knowledge
- Simpler mental model — no server/client component distinction
- `getServerSideProps` / `getStaticProps` are well-understood patterns
- Easier to hire for — more developers know Pages Router

**Cons:**
- No React Server Components — everything ships client JS by default
- API routes in `pages/api/` are less flexible than Route Handlers
- No streaming support — cannot do SSE natively (would need custom server)
- Middleware is less capable in Pages Router
- No built-in support for `loading.tsx`, `error.tsx`, parallel routes, intercepting routes
- Next.js team is investing in App Router; Pages Router is in maintenance mode
- No native `ReadableStream` support for SSE — would need a custom Node.js server

**Why rejected**: The Pages Router cannot do SSE via `ReadableStream` in API routes without a custom server — and Vercel serverless doesn't support custom servers. The App Router's Route Handlers with `ReadableStream` make SSE possible on Vercel. This alone would justify the choice. Additionally, App Router is the future of Next.js, and starting a new project on Pages Router in 2026 means choosing a deprecated architecture.

### Other Frameworks (Remix, SvelteKit, Astro)

**Pros:**
- Remix has excellent form handling and progressive enhancement
- SvelteKit has smaller bundle sizes
- Astro is great for content-heavy sites

**Cons:**
- No SSE support comparable to Next.js Route Handlers + `ReadableStream`
- Smaller ecosystems than Next.js
- NextAuth.js has the best Microsoft Entra ID integration, which is critical for 2care4 SSO
- Vercel deployment is most seamless with Next.js
- LiveKit has official React components (`@livekit/components-react`) — Next.js + React is the natural choice

**Why rejected**: The combination of NextAuth.js (best Azure AD integration), LiveKit React components, and Vercel deployment makes Next.js the obvious choice. No other framework offers this specific combination.

## Consequences

**Positive:**
- SSE via `ReadableStream` works on Vercel — critical for presence and chat (see ADR-002)
- Server Components reduce client JS — the login page ships zero JavaScript
- Dynamic imports (`next/dynamic`) let us lazy-load the ~400KB LiveKit SDK — initial page JS is ~50KB instead of ~134KB
- Route Handlers give us a clean REST API surface (each route file exports `GET`, `POST`, `PUT`, `DELETE`)
- `middleware.ts` provides edge-level auth guarding with zero client overhead
- Built-in support for `loading.tsx`, `error.tsx`, and streaming — future-proof for adding loading states and error boundaries
- React 19 + Server Components = better performance out of the box

**Negative:**
- App Router has a steeper learning curve — server/client component distinction, new caching semantics
- React 19 is bleeding edge — some libraries not yet compatible
- The `"use client"` / `"use server"` boundary requires deliberate thinking about where state lives
- Server Components cannot use hooks or browser APIs — must wrap in client components
- Smaller community knowledge base compared to Pages Router (though rapidly growing)
- Next.js 15 introduced breaking changes from 14 — AGENTS.md files reference version-specific docs

**Mitigations:**
- The project uses `AGENTS.md` to warn AI agents about Next.js 15-specific APIs
- `next/dynamic` with `ssr: false` isolates browser-only dependencies
- The component tree is structured to maximize server rendering (login page) while keeping interactive parts as client components (canvas, chat, audio)

## Technical Details

### Component Architecture

```
app/
├── layout.tsx          — Server Component (root layout, fonts, metadata)
├── page.tsx            — Client Component (office canvas, needs browser APIs)
├── login/page.tsx      — Server Component (no JS needed, form action is server-side)
├── editor/page.tsx     — Client Component (drag-and-drop layout editor)
└── api/
    ├── auth/[...nextauth]/route.ts  — Route Handler (NextAuth.js)
    ├── livekit/token/route.ts       — Route Handler (POST: generate JWT)
    ├── presence/route.ts            — Route Handler (POST: heartbeat, GET: SSE)
    ├── chat/route.ts                — Route Handler (POST: send, GET: SSE)
    └── layouts/route.ts             — Route Handler (CRUD)
```

### Dynamic Import Strategy

```typescript
// LiveKit SDK (~400KB) is only loaded after user clicks "Gå til kontoret"
const LazyOfficeCanvas = dynamic(() => import("@/components/OfficeCanvas"), {
  ssr: false,
  loading: () => <LoadingPlaceholder />,
});

// useLiveKitRoom hook is loaded via manual dynamic import
// to avoid pulling livekit-client into the initial bundle
```

### Route Handler Pattern

Each API route is a single `route.ts` file exporting HTTP method handlers:

```typescript
// POST /api/presence — heartbeat
export async function POST(req: NextRequest) { ... }

// GET /api/presence — SSE stream
export async function GET(req: NextRequest) { ... }
```

This is cleaner than the Pages Router pattern of `if (req.method === "POST")` switching.

## References

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Next.js App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- `src/middleware.ts` — Auth guard middleware
- `src/app/page.tsx` — Main office page with dynamic imports
- `src/app/login/page.tsx` — Server Component login page