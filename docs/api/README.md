# VirtualOffice API Reference

## Overview

VirtualOffice exposes 5 API route groups under `/api/`. All routes are part of the Next.js 15 App Router and follow Route Handler conventions (export `GET`, `POST`, `PUT`, `DELETE` functions from `route.ts` files).

**Base URL**: `http://localhost:3000` (dev) or `https://<your-project>.vercel.app` (production)

**Authentication**: All API routes except `/api/auth` and the login page are protected by Next.js middleware (`src/middleware.ts`). Unauthenticated requests are redirected to `/login`. The presence and chat endpoints are called from the client after auth.

---

## 1. LiveKit Token API

Generate a LiveKit access token for joining an audio room.

### `POST /api/livekit/token`

**Request body** (JSON):

```json
{
  "roomName": "virtual-office",
  "participantName": "Alice"
}
```

| Field            | Type   | Required | Description                     |
|------------------|--------|----------|---------------------------------|
| `roomName`       | string | Yes      | LiveKit room name (sanitized to `[a-zA-Z0-9_-]`, max 64 chars) |
| `participantName`| string | Yes      | Display name (max 128 chars)    |

**Success response** (200):

```json
{
  "token": "eyJhbGciOi...",
  "serverUrl": "wss://my-project.livekit.cloud",
  "roomName": "virtual-office"
}
```

| Field       | Type   | Description                              |
|-------------|--------|------------------------------------------|
| `token`     | string | LiveKit JWT with room join + publish grants |
| `serverUrl` | string | WebSocket URL for LiveKit Cloud instance |
| `roomName`  | string | Sanitized room name (echoed back)        |

**Token grants**: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`. The `canPublishData` grant enables the position-sync data channel (20Hz position broadcast).

**Error responses**:

| Status | Body                                                    | Condition                     |
|--------|--------------------------------------------------------|-------------------------------|
| 400    | `{"error": "roomName and participantName are required"}` | Missing fields                |
| 500    | `{"error": "LiveKit not configured — set LIVEKIT_API_KEY..."}` | Missing environment variables |
| 500    | `{"error": "Failed to generate LiveKit token"}`          | SDK error                     |

**Environment variables required**:
- `LIVEKIT_API_KEY` — LiveKit Cloud API key
- `LIVEKIT_API_SECRET` — LiveKit Cloud API secret
- `NEXT_PUBLIC_LIVEKIT_URL` — WebSocket URL (e.g. `wss://my-project.livekit.cloud`)

**Client usage** (from `useLiveKitRoom.ts`):

```typescript
const res = await fetch("/api/livekit/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomName: "virtual-office", participantName: "Alice" }),
});
const { token, serverUrl } = await res.json();
// Pass token + serverUrl to livekit-client Room.connect()
```

**Security notes**:
- Room name is sanitized via `replace(/[^a-zA-Z0-9_-]/g, "_")` — prevents injection
- Token identity is scoped to the participant name
- No admin grants are issued

---

## 2. SSE Presence System

Track who's online in the office and where they are. Two operations: heartbeat (POST) and stream (GET).

### `POST /api/presence` — Heartbeat

Send position and identity every ~4 seconds. Users go stale after 15 seconds without a heartbeat.

**Request body** (JSON):

```json
{
  "userId": "user-1a2b3c4d",
  "name": "Alice",
  "email": "alice@virtual-office.local",
  "x": 380,
  "y": 700
}
```

| Field    | Type   | Required | Description                                     |
|----------|--------|----------|-------------------------------------------------|
| `userId` | string | Yes      | Stable identifier (max 128 chars)               |
| `name`   | string | Yes      | Display name (max 256 chars)                    |
| `email`  | string | Yes      | Email-like identifier (max 256 chars)           |
| `x`      | number | No       | X position on canvas (default: 0)               |
| `y`      | number | No       | Y position on canvas (default: 0)               |

**Success response** (200):

```json
{ "ok": true }
```

**Error responses**:

| Status | Body                                            | Condition           |
|--------|-------------------------------------------------|---------------------|
| 400    | `{"error": "userId, name, and email are required"}` | Missing required fields |
| 500    | `{"error": "Database fejl"}`                      | Postgres error      |

**Database behavior**:
- Uses `INSERT ... ON CONFLICT (user_id) DO UPDATE` (upsert)
- Updates `last_seen` to `now()` on every heartbeat
- Sets `online = TRUE`

### `GET /api/presence` — SSE Stream

Subscribe to presence changes via Server-Sent Events.

**Request**: `GET /api/presence`

**Response**: `Content-Type: text/event-stream`

**SSE events**:

```
event: presence
data: [{"user_id":"user-1a2b3c4d","name":"Alice","email":"...","x":380,"y":700,"last_seen":"...","online":true}]

: keepalive
```

| Event       | Payload                         | Description                                  |
|-------------|---------------------------------|----------------------------------------------|
| `presence`  | `PresenceUser[]` (JSON array)   | Full snapshot of online users, pushed on change |
| (comment)   | `: keepalive`                   | Sent every 2 seconds when no data change    |

**PresenceUser schema**:

```typescript
interface PresenceUser {
  user_id: string;   // Stable identifier
  name: string;      // Display name
  email: string;     // Email-like identifier
  x: number;         // X position on canvas
  y: number;         // Y position on canvas
  last_seen: string; // ISO 8601 timestamp
  online: boolean;   // Always true in stream (false users filtered out)
}
```

**Polling / keepalive behavior**:
- Polls `getOnlineUsers()` every 2 seconds
- Only pushes a `presence` event when the JSON serialization differs from the previous push (differential updates)
- When unchanged, sends a `: keepalive` SSE comment to prevent connection timeout
- Stale users (>15 seconds without heartbeat) are marked offline server-side before each poll
- Stream closes on client disconnect (`req.signal` abort)

**Headers sent**:
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

**Client usage** (from `usePresence.ts`):

```typescript
const es = new EventSource("/api/presence");
es.addEventListener("presence", (event) => {
  const users: PresenceUser[] = JSON.parse(event.data);
  // Update UI
});
```

**Architecture note**: Presence is independent of LiveKit. It works even if the LiveKit connection fails or isn't configured — users see who's online regardless of audio state. This design choice means presence works across tabs, after page reload, and survives LiveKit disconnections.

---

## 3. Chat API (SSE)

Text chat with room-scoped messages and private DMs. Messages auto-expire after 5 minutes.

### `POST /api/chat` — Send Message

**Request body** (JSON):

**Room message**:
```json
{
  "scope": "room",
  "room_id": "eng-pod",
  "sender_id": "user-1a2b3c4d",
  "sender_name": "Alice",
  "text": "Anyone free for a quick sync?",
  "x": 380,
  "y": 500
}
```

**Private message**:
```json
{
  "scope": "private",
  "sender_id": "user-1a2b3c4d",
  "sender_name": "Alice",
  "recipient_id": "user-5e6f7a8b",
  "text": "Hey, got a minute?",
  "x": 380,
  "y": 500
}
```

| Field          | Type   | Required            | Description                           |
|----------------|--------|---------------------|---------------------------------------|
| `scope`        | string | Yes                 | `"room"` or `"private"`              |
| `room_id`      | string | If scope=`"room"`   | Room identifier                       |
| `sender_id`    | string | Yes                 | Stable user identifier (max 128 chars)|
| `sender_name`  | string | Yes                 | Display name (max 128 chars)          |
| `recipient_id` | string | If scope=`"private"`| Recipient user identifier (max 128 chars) |
| `text`         | string | Yes                 | Message text (trimmed, max 500 chars) |
| `x`            | number | No                  | Sender X position (for chat bubbles)  |
| `y`            | number | No                  | Sender Y position                     |

**Success response** (200):

```json
{
  "ok": true,
  "message": {
    "id": "uuid-...",
    "scope": "room",
    "room_id": "eng-pod",
    "sender_id": "user-1a2b3c4d",
    "sender_name": "Alice",
    "recipient_id": null,
    "text": "Anyone free for a quick sync?",
    "x": 380,
    "y": 500,
    "created_at": "2026-06-06T12:00:00.000Z",
    "expires_at": "2026-06-06T12:05:00.000Z"
  }
}
```

**Error responses**:

| Status | Body                                              | Condition               |
|--------|---------------------------------------------------|-------------------------|
| 400    | `{"error": "scope, sender_id, sender_name, and text are required"}` | Missing fields |
| 400    | `{"error": "scope must be \"room\" or \"private\""}` | Invalid scope           |
| 400    | `{"error": "room_id is required for room scope"}`   | Missing room_id         |
| 400    | `{"error": "recipient_id is required for private scope"}` | Missing recipient_id |
| 400    | `{"error": "text must not be empty"}`               | Empty or whitespace-only text |
| 500    | `{"error": "Database fejl"}`                        | Postgres error          |

**Validation**:
- `text` is trimmed and truncated to 500 characters
- `scope` must be exactly `"room"` or `"private"`
- `room_id` required for room scope; `recipient_id` required for private scope
- All string fields are length-capped

### `GET /api/chat` — SSE Stream

Subscribe to chat messages via Server-Sent Events.

**Query parameters**:

| Param  | Type   | Description                                    |
|--------|--------|------------------------------------------------|
| `room` | string | Filter to room messages for this room ID       |
| `dm`   | string | Filter to private DM messages with this user   |

**Examples**:
- `GET /api/chat` — all active messages (global feed)
- `GET /api/chat?room=eng-pod` — messages in the Engineering pod
- `GET /api/chat?dm=user-5e6f7a8b` — private messages with a specific user

**Response**: `Content-Type: text/event-stream`

**SSE events**:

```
event: chat
data: [{"id":"uuid-...","scope":"room","room_id":"eng-pod","sender_id":"...","sender_name":"Alice","text":"Hey!","x":380,"y":500,"created_at":"...","expires_at":"..."}]

: keepalive
```

| Event      | Payload                        | Description                                  |
|------------|--------------------------------|----------------------------------------------|
| `chat`     | `ChatMessage[]` (JSON array)   | Full message list, pushed on change          |
| (comment)  | `: keepalive`                  | Sent every 1.5 seconds when no data change   |

**ChatMessage schema**:

```typescript
interface ChatMessage {
  id: string;           // UUID
  scope: "room" | "private";
  room_id: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  text: string;
  x: number;
  y: number;
  created_at: string;   // ISO 8601
  expires_at: string;   // ISO 8601 (created_at + 5 min)
}
```

**Polling / keepalive behavior**:
- Polls `getChatMessages()` every 1.5 seconds
- Differential updates (only pushes when message list changes)
- Every 20th poll cycle (~30 seconds), runs `purgeExpiredMessages()` to clean up expired messages
- Messages expire server-side after 5 minutes (enforced via `expires_at > now()` in all queries)
- Maximum 200 messages returned per query

**DM message retrieval**:
- Fetches messages where `(sender_id = A AND recipient_id = B) OR (sender_id = B AND recipient_id = A)` — bidirectional
- Messages are ordered by `created_at ASC` (oldest first, like a chat log)

**Headers sent**:
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

**Client usage** (from `useChat.ts`):

```typescript
// Room chat
const { messages, send } = useChat({ roomId: "eng-pod" });

// Private DM
const { messages, send } = useChat({ dmWith: "user-5e6f7a8b" });

// Send a message
await send({
  scope: "room",
  text: "Hello!",
  senderId: "user-1a2b3c4d",
  senderName: "Alice",
  x: 380,
  y: 500,
});
```

**Architecture note**: Chat is independent of LiveKit. Text chat works even without audio — useful for quick messages when audio isn't appropriate, or as a fallback when LiveKit is unavailable.

---

## 4. Azure AD SSO Flow

Authentication is handled by NextAuth.js v5 with the Microsoft Entra ID (Azure AD) provider. There is no custom login API — it uses the standard OIDC flow.

### `GET /api/auth/[...nextauth]`

Standard NextAuth.js catch-all route. Handles:
- `/api/auth/signin` — initiate sign-in
- `/api/auth/callback` — OIDC callback (Azure AD redirects here)
- `/api/auth/session` — get current session
- `/api/auth/signout` — sign out

**Provider**: `MicrosoftEntraID` (next-auth/providers/microsoft-entra-id)

**OIDC scopes requested**: `openid profile email`

**Session strategy**: JWT (not database sessions)

**Token claims stored**:
- `sub` / `id` — Azure AD object ID
- `email` — user's email
- `name` — display name
- `tid` — Azure AD tenant ID (for future multi-tenant support)

**Session max age**: 8 hours

**Redirect flow**:

```
1. User visits / → middleware redirects to /login
2. User clicks "Sign in with Microsoft"
3. Browser redirects to Microsoft Entra ID OAuth consent screen
4. User consents → redirects back to /api/auth/callback/microsoft-entra-id
5. NextAuth.js exchanges authorization code for tokens
6. JWT claims extracted, session created
7. User redirected to / (main office)
```

**Middleware protection** (`src/middleware.ts`):

| Route pattern          | Behavior                                     |
|------------------------|----------------------------------------------|
| `/login`               | Allowed for unauthenticated users            |
| `/api/auth/*`          | Allowed for unauthenticated users            |
| Everything else        | Redirect unauthenticated → `/login?callbackUrl=...` |
| Authenticated on `/login` | Redirect to `/`                            |

**Custom sign-in page**: `/login` (server component with `signIn("microsoft-entra-id", { redirectTo: "/" })`)

**Environment variables required**:
- `AUTH_MICROSOFT_ENTRA_ID_ID` — Azure AD application (client) ID
- `AUTH_MICROSOFT_ENTRA_ID_SECRET` — Azure AD client secret
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER` — `https://login.microsoftonline.com/{tenant-id}/v2.0`
- `NEXTAUTH_SECRET` — JWT encryption secret (generate: `openssl rand -hex 32`)
- `NEXTAUTH_URL` — Auto-detected in dev, required in production

**Azure AD app registration requirements**:
- Redirect URI: `https://<your-domain>/api/auth/callback/microsoft-entra-id`
- Supported account types: Single tenant (2care4 directory only) or multi-tenant
- Implicit grant: ID tokens
- Platform: Web

---

## 5. Layouts API

CRUD for office floor layouts. Used by the Layout Editor at `/editor`.

### `GET /api/layouts`

List all layouts or get a single one.

**Query parameters**:

| Param | Type   | Description                        |
|-------|--------|------------------------------------|
| `id`  | string | Get a specific layout by UUID      |

**Response** (200):

```json
// GET /api/layouts — list
[
  {
    "id": "uuid-...",
    "name": "Klassisk kontor",
    "floor_width": 2400,
    "floor_height": 1350,
    "rooms": [
      {
        "id": "meeting-a",
        "name": "Mødelokale A",
        "type": "meeting",
        "x": 60, "y": 70, "w": 240, "h": 200
      }
    ],
    "created_at": "2026-06-06T12:00:00.000Z",
    "updated_at": "2026-06-06T12:00:00.000Z"
  }
]

// GET /api/layouts?id=uuid — single
{ /* same shape as above */ }
```

**Errors**:

| Status | Body                          | Condition         |
|--------|-------------------------------|-------------------|
| 404    | `{"error": "Ikke fundet"}`    | Layout not found  |
| 500    | `{"error": "Database fejl"}`  | Postgres error    |

### `POST /api/layouts`

Create a new layout.

**Request body** (JSON):

```json
{
  "name": "Nyt kontor",
  "floor_width": 2400,
  "floor_height": 1350,
  "rooms": []
}
```

| Field          | Type          | Required | Default | Description               |
|----------------|---------------|----------|---------|---------------------------|
| `name`         | string        | Yes      | —       | Layout name               |
| `floor_width`  | number        | No       | 2400    | Canvas width in pixels    |
| `floor_height` | number        | No       | 1350    | Canvas height in pixels   |
| `rooms`        | LayoutRoom[]  | No       | []      | Array of room definitions |

**LayoutRoom shape**:
```typescript
interface LayoutRoom {
  id: string;                           // Unique room identifier
  name: string;                         // Display name
  type: "meeting" | "focus" | "social" | "open";
  x: number;                            // Top-left X
  y: number;                            // Top-left Y
  w: number;                            // Width
  h: number;                            // Height
}
```

**Response** (201):

```json
{
  "id": "uuid-...",
  "name": "Nyt kontor",
  "floor_width": 2400,
  "floor_height": 1350,
  "rooms": [],
  "created_at": "2026-06-06T12:00:00.000Z",
  "updated_at": "2026-06-06T12:00:00.000Z"
}
```

### `PUT /api/layouts?id=<uuid>`

Update an existing layout. Partial updates supported.

**Query parameters**: `id` (required) — UUID of the layout to update

**Request body** (JSON, all fields optional):

```json
{
  "name": "Renamed kontor",
  "rooms": [{ "id": "new-room", "name": "Nyt rum", "type": "open", "x": 100, "y": 100, "w": 200, "h": 150 }]
}
```

**Response** (200): Updated layout object (same shape as GET).

**Errors**: 400 (missing `id`), 404 (not found), 500 (DB error)

### `DELETE /api/layouts?id=<uuid>`

Delete a layout by UUID.

**Query parameters**: `id` (required)

**Response** (200):

```json
{ "success": true }
```

**Errors**: 400 (missing `id`), 404 (not found), 500 (DB error)