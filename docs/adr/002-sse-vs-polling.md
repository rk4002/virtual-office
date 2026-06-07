# ADR-002: SSE vs Polling for Presence and Chat

**Status**: Accepted  
**Date**: 2026-06-05  
**Deciders**: Rasmus (2care4)

## Context

VirtualOffice needs real-time presence tracking (who's online, where they are) and text chat (room-scoped and private DMs). Both systems need to push updates to connected clients with low latency. Three approaches were evaluated:

1. **Client-side polling** — Clients fetch `/api/presence` and `/api/chat` on a timer (e.g., every 2 seconds)
2. **WebSockets** — Persistent bidirectional connection (e.g., via `ws` library or Pusher)
3. **Server-Sent Events (SSE)** — Server pushes updates over a long-lived HTTP connection via `ReadableStream`

## Decision

**We chose SSE** for both presence and chat, with a polling-based backend (server queries the database on an interval and pushes changes).

The architecture:
- Client opens an `EventSource` to `/api/presence` (GET) and `/api/chat` (GET)
- Server polls Vercel Postgres every 2 seconds (presence) / 1.5 seconds (chat)
- Server only pushes SSE events when data has changed (differential updates)
- When unchanged, sends an SSE comment (`: keepalive`) to prevent timeout
- Clients send data via separate POST requests (heartbeat, chat messages)

## Alternatives Considered

### Client-side Polling (fetch on interval)

**Pros:**
- Simplest to implement — just `fetch()` on a timer
- Works everywhere, no special infrastructure
- Stateless on the server; each request is independent

**Cons:**
- Every client hits the database on every interval — 15 users polling every 2s = 7.5 DB queries/second for presence alone
- Wastes bandwidth and DB resources when nothing changed
- Higher latency (up to the poll interval)
- No push mechanism — client must wait for next tick

**Why rejected**: For a pilot with 15 users this might work, but it doesn't scale and wastes resources. SSE gives us push semantics without the complexity of WebSockets.

### WebSockets (via Pusher or ws library)

**Pros:**
- True real-time push with sub-100ms latency
- Bidirectional — single connection for both send and receive
- Industry standard for chat applications
- Pusher provides managed infrastructure

**Cons:**
- WebSocket connections are stateful — problematic on Vercel serverless (connections get severed when functions cold-start)
- Requires an external service (Pusher) or a separate WebSocket server (not Vercel-compatible)
- Vercel serverless functions have execution time limits (10s on Hobby, 60s on Pro) — cannot hold a persistent WebSocket connection
- More complex client logic (reconnection, binary frames, heartbeat management)
- Pusher adds another vendor dependency and cost
- The initial plan to use Pusher was scrapped when realizing SSE + ReadableStream works on Vercel

**Why rejected**: The Vercel serverless architecture fundamentally doesn't support persistent WebSocket connections. Pusher was considered but adds cost and complexity for a 15-user pilot. SSE with a polling backend works within Vercel's constraints.

### Why SSE Works on Vercel

This is the key insight: **SSE via `ReadableStream` works on Vercel because the streaming response keeps the function alive**. Vercel supports streaming responses for Edge Functions and Node.js functions. The function stays alive as long as the stream is open (subject to the function duration limit):

- **Hobby plan**: 10 seconds — too short for SSE
- **Pro plan**: 60 seconds — can be extended to 300s via `maxDuration`
- **Enterprise**: Up to 900 seconds

For production, we'll use the Pro plan with `maxDuration: 300` in `vercel.json`. The 5-minute limit is acceptable because:
1. The client reconnects automatically on connection close (3-second reconnect timer in `usePresence.ts` and `useChat.ts`)
2. The slight gap during reconnection is invisible — the database has the current state
3. Chat messages auto-expire after 5 minutes anyway, perfectly matching the connection lifecycle

## Consequences

**Positive:**
- Works on Vercel serverless — no separate infrastructure needed
- No additional vendor costs (Vercel Postgres handles the DB, SSE is built into Next.js Route Handlers)
- Simple client implementation — `EventSource` is a standard browser API with built-in reconnection
- Differential updates save bandwidth (only push when data changes)
- Independent of LiveKit — presence and chat work even without audio
- Automatic reconnection with no message loss (server sends the full state on each connect)

**Negative:**
- Not true real-time — up to 2-second latency for presence, 1.5-second for chat (acceptable for our use case)
- Function duration limits on Vercel Hobby plan (10s) require Pro plan for production
- Each connected client holds a serverless function instance, potentially hitting concurrency limits
- SSE is a legacy technology — less "cool" than WebSockets, but pragmatically correct here
- No native binary support (not needed — our payloads are JSON)

## Technical Details

### Presence SSE (`src/app/api/presence/route.ts`)

```
Client → GET /api/presence → SSE stream
Client → POST /api/presence → heartbeat (every 4s)

Server polls getOnlineUsers() every 2s
Stale users (>15s without heartbeat) are auto-marked offline
Differential push: only send SSE event when JSON changes
Keepalive: `: keepalive\n\n` every 2s when unchanged
```

### Chat SSE (`src/app/api/chat/route.ts`)

```
Client → GET /api/chat?room=eng-pod → SSE stream
Client → POST /api/chat → send message

Server polls getChatMessages() every 1.5s
Purges expired messages every 30s (~20th poll cycle)
Differential push + keepalive same as presence
Query params: ?room=<id> for room scope, ?dm=<user_id> for private DMs
```

### Client Hooks

- `usePresence()` in `src/hooks/usePresence.ts` — `EventSource` with auto-reconnect (3s fallback)
- `useHeartbeat()` in `src/hooks/usePresence.ts` — POSTs position every 4s
- `useChat()` in `src/hooks/useChat.ts` — `EventSource` with filter params + send function

## References

- [Vercel Streaming (SSE) Documentation](https://vercel.com/docs/functions/streaming)
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN: EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- `src/app/api/presence/route.ts` — Presence SSE implementation
- `src/app/api/chat/route.ts` — Chat SSE implementation
- `src/hooks/usePresence.ts` — Client-side presence hook
- `src/hooks/useChat.ts` — Client-side chat hook