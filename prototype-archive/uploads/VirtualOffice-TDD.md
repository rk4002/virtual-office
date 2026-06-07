# VirtualOffice — Teknisk Design Dokument

**Version:** 1.0  
**Dato:** 2026-05-20  
**Forfatter:** Teknisk arkitektur  
**Status:** Draft — til review og godkendelse før build

---

## Indholdsfortegnelse

1. [Produkt-overblik](#1-produkt-overblik)
2. [Systemarkitektur](#2-systemarkitektur)
3. [Datamodel](#3-datamodel)
4. [Auth-flow](#4-auth-flow)
5. [LiveKit integration](#5-livekit-integration)
6. [Map Editor](#6-map-editor)
7. [Stripe Billing](#7-stripe-billing)
8. [API Design](#8-api-design)
9. [Roller og rettigheder](#9-roller-og-rettigheder)
10. [Microsoft Graph integration](#10-microsoft-graph-integration)
11. [Infrastruktur og hosting](#11-infrastruktur-og-hosting)
12. [Roadmap](#12-roadmap)
13. [Sikkerhed](#13-sikkerhed)

---

## 1. Produkt-overblik

### 1.1 Vision

VirtualOffice er en browserbaseret 2D virtuel arbejdsplads, der genskaber den spontane kommunikation og sociale tilstedeværelse fra et fysisk kontor — uden at kræve VPN, headsets-setup eller en planlagt mødeindkaldelse.

Medarbejdere logger ind, ser en top-down kontorplan, bevæger deres avatar rundt, og taler automatisk med kolleger baseret på nærhed. Jo tættere man er på en kollega, jo højere hører man dem. Mødelokaler er lukkede lydrum. Det er som at gå ind på kontoret — bare fra sofaen.

**Kerneprincippet:** Arbejdspladsens sociale dynamik er afhængig af den uformelle kommunikation — den spontane samtale ved kaffemaskinen, det tilfældige møde i gangen. Remote-arbejde fjerner dette. VirtualOffice genskaber det.

### 1.2 Målgruppe

**Primær:** Mellemstore virksomheder (20–200 ansatte) med hybrid eller fuldt remote setup — særligt dem der allerede bruger Microsoft 365.

**Sekundær:** Startups og tech-firmaer, remote-first teams, konsulentvirksomheder med distribuerede teams.

**ICP (Ideal Customer Profile):**
- 20–100 medarbejdere
- Allerede betaler for Slack, Zoom eller Teams
- Oplever manglen på "kontor-energi" som et reelt problem
- Har én teknisk/IT-ansvarlig der kan onboarde produktet

### 1.3 Pilotplan — 2care4

**2care4** er en dansk virksomhed med 15+ medarbejdere i IT-afdelingen og opererer i sundhedssektoren. De er det første betalende pilotkunde og bruges til at validere alle kernefeatures.

**Pilotens formål:**
- Validere spatial audio-oplevelsen i praksis
- Teste Microsoft SSO (Azure AD)
- Identificere UX-problemer i bevægelse og interaktion
- Validere at rumreservation via Microsoft Graph virker med eksisterende Outlook-kalendre
- Indsamle feedback til V2-interaktionssystemet

**Pilotplan:**

| Uge | Aktivitet |
|-----|-----------|
| 1 | Opsætning af 2care4-organisation, import af kontorplan, oprettelse af brugere via Azure AD |
| 2-3 | Daglig brug af spatial audio og tilstedeværelsesstatus |
| 4 | Aktivering af rumreservation med Outlook-sync |
| 5 | Feedback-session + struktureret interview med 5-8 brugere |
| 6 | Prioritering af rettelser og V2-backlog |

**Succeskriterie for pilot:**
- Mindst 70% af de inviterede brugere logger ind dagligt i uge 2-3
- NPS > 30 efter 4 ugers brug
- Ingen kritiske lyd-bugs rapporteret

---

## 2. Systemarkitektur

### 2.1 Overordnet arkitektur

VirtualOffice er bygget som en multi-tenant SaaS med følgende overordnede lag:

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                        │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Phaser.js       │  │  React UI    │  │  Map Editor       │  │
│  │  (game canvas)   │  │  (HUD, chat) │  │  (react-konva)    │  │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬──────────┘  │
│           └──────────────────┼───────────────────┘             │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTPS + WebSocket
         ┌─────────────────────┼───────────────────────┐
         │          Next.js API Routes (BFF)            │
         │  /api/auth  /api/rooms  /api/users  /api/*   │
         └──────┬────────────────────────┬──────────────┘
                │                        │
    ┌───────────▼──────────┐  ┌──────────▼──────────────┐
    │   PostgreSQL          │  │   LiveKit Server         │
    │   (multi-tenant,      │  │   (Azure VM)             │
    │    org_id på alt)     │  │   - audio rooms          │
    └───────────────────────┘  │   - data channels        │
                               └─────────────────────────┘
         │                        │
    ┌────▼────────────────────────▼──────────┐
    │         Azure Infrastructure           │
    │  App Service │ DB PostgreSQL │ Blob     │
    └─────────────────────────────────────────┘
```

### 2.2 Komponentoversigt

| Komponent | Teknologi | Ansvar |
|-----------|-----------|--------|
| Frontend SPA | Next.js 14 (App Router) | UI, routing, auth state |
| Game Canvas | Phaser.js 3 | 2D kort, avatarer, bevægelse |
| Map Editor | react-konva | Visuelt kortredigering |
| BFF/API | Next.js API Routes | Business logic, DB-queries |
| Auth | NextAuth.js v5 | Session, JWT, OAuth |
| Real-time lyd | LiveKit | Spatial audio, WebRTC |
| Real-time positioner | LiveKit Data Channels | Avatar-positioner broadcast |
| Database | PostgreSQL 15 | Al persistent data |
| Billing | Stripe | Abonnement, webhook events |
| Kalender-sync | Microsoft Graph API | Outlook rumreservationer |
| Asset Storage | Azure Blob Storage | Avatar-billeder, desk-dekorationer |
| Hosting | Azure App Service (B2/P2) | Next.js applikation |

### 2.3 Dataruter

**Avatar-bevægelse (high frequency):**
```
Browser → LiveKit Data Channel → LiveKit Server → Broadcast → Alle andre browsere
```
Positionsopdateringer sendes direkte via LiveKit's data channels — ikke via API-serveren. Dette sikrer <50ms latens.

**Audio (kontinuerlig):**
```
Browser Mikrofon → LiveKit SDK → LiveKit Server → Spatial mixing → Alle i nærheden
```
LiveKit håndterer alt WebRTC og audio routing. Klienten sender kun sin position, og serveren/klienten beregner volume baseret på afstand.

**Rumreservation:**
```
Browser → Next.js API → PostgreSQL (primær kilde)
                      → Microsoft Graph API (sync, valgfri)
```

**Auth:**
```
Browser → NextAuth.js → Azure AD (MSAL) ELLER email/password
        → JWT cookie → Next.js middleware → API routes
```

---

## 3. Datamodel

### 3.1 Designprincipper

- Alle tabeller har `org_id` — Row-Level Security på databaseniveau
- UUID som primærnøgler (`gen_random_uuid()`)
- Soft delete med `deleted_at` på kritiske tabeller
- `created_at` og `updated_at` på alle tabeller (trigger-baseret)

### 3.2 Tabeller

#### `orgs`
```sql
CREATE TABLE orgs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,        -- fx "2care4" → 2care4.virtualoffice.app
    name            TEXT NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'starter', -- starter | team | business
    plan_seats      INTEGER NOT NULL DEFAULT 10,
    stripe_customer_id  TEXT UNIQUE,
    stripe_sub_id       TEXT UNIQUE,
    azure_tenant_id     TEXT,                    -- til Azure AD SSO (Business-plan)
    ms_graph_token      TEXT,                    -- krypteret, til Graph API-sync
    ms_graph_sync_enabled BOOLEAN DEFAULT false,
    billing_cycle   TEXT DEFAULT 'monthly',      -- monthly | annual
    trial_ends_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
```

#### `users`
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,                        -- Azure Blob URL
    password_hash   TEXT,                        -- NULL hvis kun SSO
    email_verified  BOOLEAN DEFAULT false,
    email_verify_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,
    azure_oid       TEXT UNIQUE,                 -- Azure AD Object ID
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
```

#### `org_memberships`
```sql
CREATE TABLE org_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member', 
                    -- org_admin | team_manager | map_editor | member | guest
    status          TEXT NOT NULL DEFAULT 'active', -- active | invited | suspended
    invite_token    TEXT,
    invite_expires  TIMESTAMPTZ,
    guest_room_id   UUID,                        -- kun til guest: adgang til ét rum
    guest_expires   TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX idx_org_memberships_user_id ON org_memberships(user_id);
```

#### `floors`
```sql
CREATE TABLE floors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,               -- fx "Stueetage", "1. sal"
    floor_number    INTEGER NOT NULL DEFAULT 0,
    map_json        JSONB NOT NULL DEFAULT '{}', -- Tiled-kompatibelt JSON
    width_tiles     INTEGER NOT NULL DEFAULT 40,
    height_tiles    INTEGER NOT NULL DEFAULT 30,
    tile_size       INTEGER NOT NULL DEFAULT 32,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, floor_number)
);
```

#### `rooms`
```sql
CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    room_type       TEXT NOT NULL DEFAULT 'meeting', -- meeting | social | focus | open
    tile_x          INTEGER NOT NULL,
    tile_y          INTEGER NOT NULL,
    tile_width      INTEGER NOT NULL,
    tile_height     INTEGER NOT NULL,
    capacity        INTEGER DEFAULT 8,
    is_bookable     BOOLEAN DEFAULT true,
    audio_isolated  BOOLEAN DEFAULT true,        -- lukket lydzone
    ms_room_email   TEXT,                        -- Outlook resource mailbox email
    color           TEXT DEFAULT '#4A90D9',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

#### `desks`
```sql
CREATE TABLE desks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    tile_x          INTEGER NOT NULL,
    tile_y          INTEGER NOT NULL,
    label           TEXT,                        -- fx "Rasmus' bord"
    assigned_user_id UUID REFERENCES users(id),  -- NULL = ledig
    -- Dekoration (kun owner kan ændre)
    decoration_bg_color TEXT DEFAULT '#F5F5F0',
    decoration_photo_url TEXT,                   -- Azure Blob URL til familiefoto
    decoration_theme TEXT DEFAULT 'default',     -- default | minimal | cozy | tech
    decoration_items JSONB DEFAULT '[]',         -- array af placerede items
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

#### `presence`
```sql
CREATE TABLE presence (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    floor_id        UUID REFERENCES floors(id),
    tile_x          INTEGER,
    tile_y          INTEGER,
    status          TEXT NOT NULL DEFAULT 'offline', -- online | available | busy | dnd | offline
    busy_light      BOOLEAN DEFAULT false,        -- rød lampe på bordet
    livekit_room    TEXT,                         -- aktiv LiveKit room name
    last_seen       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, org_id)
);

CREATE INDEX idx_presence_org_id ON presence(org_id);
```

#### `bookings`
```sql
CREATE TABLE bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    booked_by       UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL DEFAULT 'Møde',
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    attendees       UUID[] DEFAULT '{}',         -- array af user_id
    ms_event_id     TEXT,                        -- Graph API event ID
    ms_sync_status  TEXT DEFAULT 'local',        -- local | synced | conflict
    notification_sent BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT no_overlap EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (deleted_at IS NULL)
);
```

#### `items`
```sql
CREATE TABLE items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL,               -- coffee | high_five | trophy | candy | flower
    from_user_id    UUID NOT NULL REFERENCES users(id),
    to_user_id      UUID NOT NULL REFERENCES users(id),
    message         TEXT,
    is_trophy       BOOLEAN DEFAULT false,       -- vises på bordet
    challenge_id    UUID,                        -- reference til mini-game (V3)
    received_at     TIMESTAMPTZ DEFAULT now(),
    seen_at         TIMESTAMPTZ
);
```

#### `challenges` (V3)
```sql
CREATE TABLE challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    challenger_id   UUID NOT NULL REFERENCES users(id),
    challenged_id   UUID NOT NULL REFERENCES users(id),
    game_type       TEXT NOT NULL,               -- rock_paper_scissors | trivia | typing_race
    status          TEXT DEFAULT 'pending',      -- pending | active | completed | declined
    winner_id       UUID REFERENCES users(id),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### `leaderboard_entries`
```sql
CREATE TABLE leaderboard_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    category        TEXT NOT NULL,               -- trophies | challenges_won | coffees_given
    score           INTEGER DEFAULT 0,
    period          TEXT DEFAULT 'all_time',     -- all_time | monthly | weekly
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id, category, period)
);
```

### 3.3 PostgreSQL Row-Level Security

```sql
-- Aktiver RLS på alle org-scoped tabeller
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE desks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- osv.

-- Policy: app-brugeren (service role) sætter org_id via session variable
CREATE POLICY org_isolation ON floors
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- I API-koden (Next.js):
-- await db.query("SET app.current_org_id = $1", [orgId]);
-- Herefter er alle queries automatisk isoleret
```

---

## 4. Auth-flow

### 4.1 Principper

- NextAuth.js v5 håndterer begge auth-flows
- JWT-strategi (stateless) med httpOnly cookies
- JWT indeholder: `userId`, `orgId`, `orgSlug`, `role`
- Multi-tenant: brugerens aktive org er del af token (kan skifte org uden re-login)
- Alle API routes validerer JWT og sætter `app.current_org_id` i PostgreSQL-sessionen

### 4.2 Flow 1: Microsoft SSO (Azure AD via MSAL)

```
1. Bruger klikker "Log ind med Microsoft"
2. NextAuth redirect → Azure AD authorize endpoint
   URL: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
   Scopes: openid profile email User.Read (+ Calendars.ReadWrite ved Graph-sync)

3. Azure AD returnerer authorization code → NextAuth callback

4. NextAuth bytter code til access_token + id_token via:
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

5. NextAuth henter brugerinfo fra Microsoft Graph:
   GET https://graph.microsoft.com/v1.0/me

6. Opslag i users-tabel på azure_oid:
   - Fundet: opdater display_name, returner user
   - Ikke fundet: opret ny user med azure_oid + email

7. Opslag i org_memberships:
   - Fundet aktiv membership: load role + org
   - Ikke fundet: vis "Anmod om adgang" eller auto-join hvis org har Azure AD sync

8. Udsted JWT cookie:
   { userId, orgId, orgSlug, role, exp: +8h }

9. Redirect til /app/[orgSlug]
```

**NextAuth Azure AD provider-konfiguration:**
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
      authorization: {
        params: {
          scope: "openid profile email User.Read Calendars.ReadWrite",
        },
      },
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Adgangskode", type: "password" },
      },
      async authorize(credentials) {
        // Se flow 2 nedenfor
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "microsoft-entra-id") {
        token.azureOid = (profile as any)?.oid;
        token.accessToken = account.access_token; // til Graph API
      }
      // Load org membership
      const membership = await getActiveMembership(token.sub!);
      token.orgId = membership.org_id;
      token.orgSlug = membership.org_slug;
      token.role = membership.role;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.orgId = token.orgId as string;
      session.user.orgSlug = token.orgSlug as string;
      session.user.role = token.role as string;
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 timer
});
```

### 4.3 Flow 2: Email + Password

```
REGISTRERING:
1. POST /api/auth/register { email, password, displayName, orgSlug? }
2. Valider email-format, password-styrke (min 8 chars, 1 tal, 1 special)
3. Bcrypt hash password (rounds: 12)
4. Gem user med email_verified = false
5. Send verificerings-email med JWT-token (exp: 24h):
   /api/auth/verify-email?token=<jwt>
6. Return 201: "Tjek din email"

EMAIL-VERIFIKATION:
1. GET /api/auth/verify-email?token=<jwt>
2. Valider token, sæt email_verified = true
3. Redirect til /login?verified=true

LOGIN:
1. POST /api/auth/callback/credentials { email, password }
2. Hent user på email, tjek deleted_at IS NULL
3. Tjek email_verified = true (ellers: "Verificer din email")
4. bcrypt.compare(password, password_hash)
5. OK → udsted JWT cookie (identisk format som SSO-flow)
6. Fejl → return 401 (generisk besked, ingen enumeration)

PASSWORD RESET:
1. POST /api/auth/forgot-password { email }
2. Svar altid 200 (anti-enumeration)
3. Hvis email findes: gem reset-token (UUID, exp: 1h), send email
4. POST /api/auth/reset-password { token, newPassword }
5. Valider token + expiry, sæt nyt bcrypt hash, invalider token
```

### 4.4 Multi-tenant session

En bruger kan have membership i flere orgs. JWT indeholder den aktive org:

```typescript
// Skift aktiv org (fx dropdown i header)
// POST /api/auth/switch-org { orgId }
// → Udsteder nyt JWT med ny orgId/orgSlug/role
// → Redirect til /app/[newOrgSlug]
```

**Middleware (tenant-isolation):**
```typescript
// middleware.ts
import { auth } from "./app/api/auth/[...nextauth]/route";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  
  // Udtræk org slug fra URL: /app/2care4/...
  const match = pathname.match(/^\/app\/([^\/]+)/);
  const urlSlug = match?.[1];
  
  // Valider at JWT-slug matcher URL-slug
  if (urlSlug && req.auth?.user?.orgSlug !== urlSlug) {
    return Response.redirect(new URL("/unauthorized", req.url));
  }
  
  // Inject org_id i request headers til API routes
  const headers = new Headers(req.headers);
  headers.set("x-org-id", req.auth?.user?.orgId ?? "");
  headers.set("x-user-id", req.auth?.user?.id ?? "");
  headers.set("x-user-role", req.auth?.user?.role ?? "");
});

export const config = {
  matcher: ["/app/:path*", "/api/app/:path*"],
};
```

---

## 5. LiveKit integration

### 5.1 Arkitektur og setup

LiveKit er kernen i realtids-kommunikation: både audio og positionsopdateringer går gennem LiveKit.

**Self-hosted vs. Cloud:**
- **MVP/Pilot:** LiveKit Cloud (managed) — hurtigere opsætning, ingen server-vedligeholdelse
- **Production (Business-plan kunder):** Self-hosted LiveKit på Azure VM (Standard_D2s_v3, 2 vCPU, 8GB RAM)

**Room-navnekonvention:**
```
{org_id}__floor__{floor_id}         → åbent kontor (spatial audio)
{org_id}__room__{room_id}           → mødelokale (isoleret lyd)
{org_id}__room__{room_id}__booking__{booking_id}  → booket møde
```

### 5.2 Spatial audio konfiguration

Spatial audio implementeres **client-side** via LiveKit's lydspor og JavaScript Web Audio API:

```typescript
// hooks/useSpatialAudio.ts
import { useEffect, useRef } from "react";
import { Room, RemoteTrack, RemoteParticipant } from "livekit-client";

const AUDIO_CUTOFF_TILES = 20;       // ingen lyd udover 20 tiles
const AUDIO_FULL_VOLUME_TILES = 3;   // fuld volume inden for 3 tiles
const TILE_SIZE_PX = 32;

interface Position { x: number; y: number }

export function useSpatialAudio(
  room: Room | null,
  myPosition: Position,
  participantPositions: Map<string, Position>
) {
  const audioNodes = useRef<Map<string, GainNode>>(new Map());
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!room) return;
    audioCtx.current = new AudioContext();

    room.on("trackSubscribed", (track: RemoteTrack, _, participant: RemoteParticipant) => {
      if (track.kind !== "audio") return;
      
      const mediaStream = new MediaStream([track.mediaStreamTrack]);
      const source = audioCtx.current!.createMediaStreamSource(mediaStream);
      const gainNode = audioCtx.current!.createGain();
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.current!.destination);
      audioNodes.current.set(participant.identity, gainNode);
    });

    return () => {
      audioCtx.current?.close();
    };
  }, [room]);

  // Opdater volume baseret på positioner
  useEffect(() => {
    participantPositions.forEach((pos, participantId) => {
      const gainNode = audioNodes.current.get(participantId);
      if (!gainNode) return;

      const distanceTiles = Math.sqrt(
        Math.pow(myPosition.x - pos.x, 2) + Math.pow(myPosition.y - pos.y, 2)
      );

      let volume = 0;
      if (distanceTiles <= AUDIO_FULL_VOLUME_TILES) {
        volume = 1.0;
      } else if (distanceTiles < AUDIO_CUTOFF_TILES) {
        // Lineær fade fra 1.0 til 0.0
        volume = 1.0 - (distanceTiles - AUDIO_FULL_VOLUME_TILES) / 
                       (AUDIO_CUTOFF_TILES - AUDIO_FULL_VOLUME_TILES);
      }
      
      gainNode.gain.setTargetAtTime(volume, audioCtx.current!.currentTime, 0.1);
    });
  }, [myPosition, participantPositions]);
}
```

### 5.3 Mødelokale-isolation

Når en bruger går ind i et mødelokale, flyttes de til et separat LiveKit room:

```typescript
// lib/livekit/roomTransition.ts
export async function enterMeetingRoom(
  currentRoom: Room,
  meetingRoomId: string,
  orgId: string,
  userId: string
) {
  // 1. Disconnect fra floor room
  await currentRoom.disconnect();
  
  // 2. Hent ny token til mødelokale-rum
  const token = await fetch("/api/app/livekit/token", {
    method: "POST",
    body: JSON.stringify({
      roomName: `${orgId}__room__${meetingRoomId}`,
      identity: userId,
    }),
  }).then(r => r.json());
  
  // 3. Connect til mødelokale-rum
  const meetingRoom = new Room();
  await meetingRoom.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token.token);
  
  return meetingRoom;
}
```

**Token-generering (server-side, aldrig client-side):**
```typescript
// app/api/app/livekit/token/route.ts
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  const { roomName, identity } = await req.json();
  const orgId = req.headers.get("x-org-id")!;
  
  // Sikkerhedstjek: brugeren må kun join rum i sin org
  if (!roomName.startsWith(orgId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity, ttl: "4h" }
  );
  
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  
  return Response.json({ token: await at.toJwt() });
}
```

### 5.4 Data channels til positionsopdateringer

Avatar-positioner sendes via LiveKit's data channels for minimal latens:

```typescript
// Sender (bevægende bruger)
const POSITION_UPDATE_INTERVAL_MS = 50; // 20 fps

function broadcastPosition(room: Room, x: number, y: number, floorId: string) {
  const data = new TextEncoder().encode(JSON.stringify({
    type: "position",
    x,
    y,
    floorId,
    timestamp: Date.now(),
  }));
  
  room.localParticipant.publishData(data, { reliable: false }); // unreliable = lavere latens
}

// Modtager (alle andre)
room.on("dataReceived", (data: Uint8Array, participant: RemoteParticipant) => {
  const msg = JSON.parse(new TextDecoder().decode(data));
  
  if (msg.type === "position") {
    updateAvatarPosition(participant.identity, msg.x, msg.y);
  }
  
  if (msg.type === "interaction") {
    handleInteractionEvent(participant.identity, msg);
  }
});
```

### 5.5 Busy Light / Do Not Disturb

Når en bruger aktiverer "Forstyr ikke" (DND):
1. `presence`-tabel opdateres: `busy_light = true`, `status = 'dnd'`
2. LiveKit metadata opdateres: `room.localParticipant.setMetadata(JSON.stringify({ status: "dnd" }))`
3. Alle andre klienter modtager `participantMetadataChanged`-event
4. Server-side: DND-brugere ekskluderes fra spatial audio-subscriptions i floor-rummet

---

## 6. Map Editor

### 6.1 Teknisk løsning

Map Editoren er en React-komponent der fungerer side-by-side med spilcanvas. Den er tilgængelig for brugere med `map_editor`- eller `org_admin`-rollen.

**Biblioteksvalg: react-konva**

| Kriterium | react-konva | fabric.js | Valg |
|-----------|-------------|-----------|------|
| React-integration | Nativ | Via wrapper | react-konva ✓ |
| Performance | God (canvas) | God (canvas) | Ens |
| Tile-grid support | Manuel implementering | Manuel | Ens |
| Typescript support | Excellent | Middelmådig | react-konva ✓ |
| Bundle size | ~200KB | ~350KB | react-konva ✓ |

### 6.2 Editor-arkitektur

```
MapEditor (React komponent)
├── Toolbar (vælg tool: draw_room, place_desk, erase, select)
├── LayerPanel (tile-lag, rum-lag, desk-lag, zone-lag)
├── KonvaCanvas
│   ├── GridLayer (tile-gitter, ikon-overlay)
│   ├── TileLayer (gulv, vægge, dekorationer)
│   ├── RoomLayer (rum-polygoner med labels)
│   ├── DeskLayer (borde med bruger-tildeling)
│   └── ZoneLayer (audio-zoner, visualiseret med farve-overlay)
├── PropertiesPanel (redigér valgte rums egenskaber)
└── ImportExportPanel (JSON import/export)
```

### 6.3 Zone-typer

| Zone-type | Farve-kode | Audio-adfærd |
|-----------|-----------|--------------|
| `open` | Ingen overlay | Fuld spatial audio |
| `meeting` | Blå (#4A90D9, 30% opacity) | Fuldstændig isolation, ingen lyd ind/ud |
| `focus` | Orange (#F5A623, 20% opacity) | DND aktiveres automatisk ved indgang |
| `social` | Grøn (#7ED321, 20% opacity) | Udvidet audio-radius (30 tiles) |
| `restricted` | Rød (#D0021B, 20% opacity) | Kun invited brugere kan entre |

### 6.4 JSON-format (Tiled-kompatibelt)

```json
{
  "version": "1.0",
  "tilewidth": 32,
  "tileheight": 32,
  "width": 40,
  "height": 30,
  "orientation": "orthogonal",
  "layers": [
    {
      "id": 1,
      "name": "floor",
      "type": "tilelayer",
      "data": [1, 1, 1, 2, 2, ...],
      "width": 40,
      "height": 30
    },
    {
      "id": 2,
      "name": "walls",
      "type": "tilelayer",
      "data": [0, 0, 3, 0, ...]
    }
  ],
  "virtualoffice": {
    "rooms": [
      {
        "id": "uuid",
        "name": "Mødelokale A",
        "type": "meeting",
        "x": 5, "y": 3,
        "width": 6, "height": 5,
        "capacity": 8,
        "bookable": true,
        "audioIsolated": true
      }
    ],
    "desks": [
      {
        "id": "uuid",
        "x": 12, "y": 8,
        "label": "Desk 1",
        "assignedUserId": null
      }
    ],
    "audioZones": [
      {
        "id": "uuid",
        "type": "social",
        "x": 20, "y": 15,
        "width": 8,
        "height": 6,
        "audiusRadius": 30
      }
    ],
    "spawnPoint": { "x": 10, "y": 15 }
  }
}
```

### 6.5 Sync med Phaser.js

Editoren og spilmotoren bruger samme JSON-format. Workflow:

```
Editor (react-konva) → Save → POST /api/app/floors/{id}/map
→ Gem i floors.map_json (PostgreSQL)
→ Phaser.js-klienter modtager "map_updated" event via LiveKit data channel
→ Phaser.js loader nyt map JSON og re-renderer kortet
```

---

## 7. Stripe Billing

### 7.1 Produkt- og prisstruktur

```
Stripe Products:
├── Starter (gratis, max 10 seats, 1 etage)
├── Team
│   ├── Price: vo_team_monthly (49 DKK/seat/month)
│   └── Price: vo_team_annual  (39 DKK/seat/month, betalt årligt)
└── Business
    ├── Price: vo_business_monthly (79 DKK/seat/month)
    └── Price: vo_business_annual  (59 DKK/seat/month, betalt årligt)
```

### 7.2 Seat management

**Metered billing** bruges ikke — i stedet: quantity-baserede subscriptions med seat-licenser:

```typescript
// Opret subscription ved signup
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId, quantity: seatCount }],
  payment_behavior: "default_incomplete",
  expand: ["latest_invoice.payment_intent"],
});

// Tilføj seat (ved invite af ny bruger)
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscriptionItemId, quantity: currentQuantity + 1 }],
  proration_behavior: "create_prorations",
});

// Fjern seat (ved fjernelse af bruger)
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscriptionItemId, quantity: currentQuantity - 1 }],
  proration_behavior: "create_prorations",
});
```

### 7.3 Webhook events

Alle Stripe webhooks behandles i `/api/webhooks/stripe`:

| Event | Handling |
|-------|----------|
| `checkout.session.completed` | Aktiver subscription, opdater org.plan og plan_seats |
| `invoice.payment_succeeded` | Forny subscription, log betaling |
| `invoice.payment_failed` | Send advarsel-email, grace period 3 dage |
| `customer.subscription.updated` | Synkroniser plan + seats med org-tabel |
| `customer.subscription.deleted` | Downgrade til Starter, deaktiver betalte features |

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  
  switch (event.type) {
    case "customer.subscription.updated":
      const sub = event.data.object as Stripe.Subscription;
      await db.query(
        `UPDATE orgs SET plan = $1, plan_seats = $2 WHERE stripe_sub_id = $3`,
        [getPlanFromPriceId(sub.items.data[0].price.id),
         sub.items.data[0].quantity,
         sub.id]
      );
      break;
    // ...
  }
  
  return Response.json({ received: true });
}
```

### 7.4 Plan enforcement

```typescript
// lib/billing/enforce.ts
export async function assertCanAddSeat(orgId: string) {
  const org = await getOrg(orgId);
  const activeSeats = await countActiveMembers(orgId);
  
  if (org.plan === "starter" && activeSeats >= 10) {
    throw new BillingError("SEAT_LIMIT_REACHED", 
      "Starter-planen tillader maks 10 brugere. Opgrader til Team.");
  }
  if (org.plan === "team" && activeSeats >= 50) {
    throw new BillingError("SEAT_LIMIT_REACHED",
      "Team-planen tillader maks 50 brugere. Opgrader til Business.");
  }
}

export async function assertCanAddFloor(orgId: string) {
  const org = await getOrg(orgId);
  const floorCount = await countFloors(orgId);
  
  const limits = { starter: 1, team: 3, business: Infinity };
  if (floorCount >= limits[org.plan]) {
    throw new BillingError("FLOOR_LIMIT_REACHED", 
      `${org.plan}-planen tillader maks ${limits[org.plan]} etage(r).`);
  }
}
```

---

## 8. API Design

### 8.1 REST Endpoints

Alle API-routes er under `/api/app/` og kræver authenticated JWT (via middleware).

#### Auth
| Method | Path | Beskrivelse |
|--------|------|-------------|
| POST | `/api/auth/register` | Opret bruger med email/password |
| GET | `/api/auth/verify-email` | Verificer email med token |
| POST | `/api/auth/forgot-password` | Send reset-email |
| POST | `/api/auth/reset-password` | Nyt password med reset-token |
| POST | `/api/auth/switch-org` | Skift aktiv organisation |

#### Brugere og org
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/me` | Hent egen profil + org membership |
| PATCH | `/api/app/me` | Opdater display_name, avatar_url |
| GET | `/api/app/org` | Hent org-info (plan, seats, settings) |
| GET | `/api/app/org/members` | List alle members med rolle + presence |
| POST | `/api/app/org/members/invite` | Inviter ny bruger (email + rolle) |
| DELETE | `/api/app/org/members/{userId}` | Fjern bruger fra org |
| PATCH | `/api/app/org/members/{userId}/role` | Skift rolle |

#### Floors og map
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/floors` | List alle etager |
| POST | `/api/app/floors` | Opret ny etage (kræver plan-check) |
| GET | `/api/app/floors/{id}` | Hent etage inkl. map_json |
| PATCH | `/api/app/floors/{id}/map` | Gem redigeret kort (Map Editor-rollen) |
| DELETE | `/api/app/floors/{id}` | Slet etage |

#### Rum
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/floors/{id}/rooms` | List rum på etage |
| POST | `/api/app/floors/{id}/rooms` | Opret rum |
| PATCH | `/api/app/rooms/{id}` | Opdater rum |
| DELETE | `/api/app/rooms/{id}` | Slet rum |

#### Borde
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/floors/{id}/desks` | List borde på etage |
| POST | `/api/app/floors/{id}/desks` | Opret bord |
| PATCH | `/api/app/desks/{id}/assign` | Tildel bord til bruger |
| PATCH | `/api/app/desks/{id}/decorate` | Opdater bordets dekoration (kun owner) |

#### Rumreservation
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/rooms/{id}/bookings` | List bookinger (query: ?from=&to=) |
| POST | `/api/app/rooms/{id}/bookings` | Opret booking |
| PATCH | `/api/app/bookings/{id}` | Opdater booking |
| DELETE | `/api/app/bookings/{id}` | Annuller booking |

#### LiveKit
| Method | Path | Beskrivelse |
|--------|------|-------------|
| POST | `/api/app/livekit/token` | Udsted LiveKit access token |

#### Billing
| Method | Path | Beskrivelse |
|--------|------|-------------|
| GET | `/api/app/billing` | Hent subscription-info |
| POST | `/api/app/billing/checkout` | Start Stripe Checkout-session |
| POST | `/api/app/billing/portal` | Åbn Stripe Customer Portal |
| POST | `/api/webhooks/stripe` | Stripe webhook modtager |

### 8.2 Vigtige response-formater

**Presence/member list:**
```json
{
  "members": [
    {
      "userId": "uuid",
      "displayName": "Rasmus Kronborg",
      "avatarUrl": "https://...",
      "role": "org_admin",
      "presence": {
        "status": "available",
        "busyLight": false,
        "floorId": "uuid",
        "tileX": 12,
        "tileY": 8
      }
    }
  ]
}
```

**Map JSON:** Se sektion 6.4.

**Booking:**
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "roomName": "Mødelokale A",
  "title": "Sprint planning",
  "startsAt": "2026-05-20T09:00:00Z",
  "endsAt": "2026-05-20T10:00:00Z",
  "bookedBy": { "userId": "uuid", "displayName": "Rasmus Kronborg" },
  "attendees": ["uuid", "uuid"],
  "msSyncStatus": "synced"
}
```

### 8.3 WebSocket / LiveKit Data Channel events

Disse er ikke REST — de sendes via LiveKit data channels:

| Event type | Sender | Payload |
|------------|--------|---------|
| `position` | Alle clients | `{ type, x, y, floorId, timestamp }` |
| `status_change` | Participant metadata | `{ status, busyLight }` |
| `map_updated` | Server (via broadcast) | `{ floorId, version }` |
| `interaction` | Klient | `{ type: "say_hi" / "give_item", targetId, itemType? }` |
| `booking_update` | Server (via broadcast) | `{ roomId, action: "created"/"cancelled" }` |

---

## 9. Roller og rettigheder

### 9.1 Rollehierarki

```
org_admin
  └── team_manager
        └── map_editor
              └── member
                    └── guest
```

### 9.2 Permission Matrix

| Handling | org_admin | team_manager | map_editor | member | guest |
|----------|:---------:|:------------:|:----------:|:------:|:-----:|
| Administrere billing | ✓ | ✗ | ✗ | ✗ | ✗ |
| Invitere brugere | ✓ | ✓* | ✗ | ✗ | ✗ |
| Ændre bruger-roller | ✓ | ✗ | ✗ | ✗ | ✗ |
| Fjerne brugere | ✓ | ✓* | ✗ | ✗ | ✗ |
| Redigere org-indstillinger | ✓ | ✗ | ✗ | ✗ | ✗ |
| Redigere kort | ✓ | ✗ | ✓ | ✗ | ✗ |
| Oprette/slette rum | ✓ | ✗ | ✓ | ✗ | ✗ |
| Tildele borde | ✓ | ✓* | ✗ | ✗ | ✗ |
| Booke mødelokaler | ✓ | ✓ | ✓ | ✓ | ✓** |
| Annullere andres booking | ✓ | ✓* | ✗ | ✗ | ✗ |
| Dekorere eget bord | ✓ | ✓ | ✓ | ✓ | ✗ |
| Bevæge avatar | ✓ | ✓ | ✓ | ✓ | ✓** |
| Se presence | ✓ | ✓ | ✓ | ✓ | ✗ |
| Aktivere Graph-sync | ✓ | ✗ | ✗ | ✗ | ✗ |

`*` = kun i eget team-område  
`**` = kun i tildelt rum

### 9.3 Middleware implementation

```typescript
// lib/auth/permissions.ts
type Permission = 
  | "billing:manage"
  | "users:invite"
  | "users:remove"
  | "map:edit"
  | "rooms:create"
  | "desks:assign"
  | "bookings:create"
  | "bookings:cancel_others"
  | "desk:decorate_own"
  | "presence:view";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  org_admin: [
    "billing:manage", "users:invite", "users:remove",
    "map:edit", "rooms:create", "desks:assign",
    "bookings:create", "bookings:cancel_others",
    "desk:decorate_own", "presence:view"
  ],
  team_manager: [
    "users:invite", "desks:assign",
    "bookings:create", "bookings:cancel_others",
    "desk:decorate_own", "presence:view"
  ],
  map_editor: [
    "map:edit", "rooms:create",
    "bookings:create", "desk:decorate_own", "presence:view"
  ],
  member: ["bookings:create", "desk:decorate_own", "presence:view"],
  guest:  ["bookings:create"],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Brug i API route:
export function requirePermission(permission: Permission) {
  return (handler: Function) => async (req: Request) => {
    const role = req.headers.get("x-user-role")!;
    if (!hasPermission(role, permission)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req);
  };
}
```

---

## 10. Microsoft Graph integration

### 10.1 Scope og begrænsninger

Graph-integrationen er **valgfri** og aktiveres på org-niveau. Den kræver:
- Business-plan (Azure AD SSO)
- En Azure AD App Registration med `Calendars.ReadWrite` + `Place.Read.All`
- En Outlook resource mailbox per bookbart mødelokale

### 10.2 OAuth2-flow til Graph-adgang

VirtualOffice bruger **delegated permissions** (ikke application permissions) — det betyder Graph API tilgås på vegne af en specifik admin-bruger, ikke hele tenanten.

```
1. Org Admin klikker "Aktivér Outlook sync"
2. Redirect til Azure AD consent-flow:
   scope: Calendars.ReadWrite Place.Read.All offline_access
   
3. Azure returnerer authorization code
4. Backend bytter til access_token + refresh_token
5. Gem krypteret refresh_token i orgs.ms_graph_token
6. Test-kald: hent liste over rum-mailboxes
7. Admin mapper VirtualOffice-rum til Outlook-resource mailboxes
```

### 10.3 Synkroniseringslogik

**Retning:** Bidirektionel, med VirtualOffice som primær kilde.

```typescript
// lib/graph/syncBooking.ts
import { Client } from "@microsoft/microsoft-graph-client";

export async function syncBookingToOutlook(bookingId: string) {
  const booking = await getBooking(bookingId);
  const room = await getRoom(booking.room_id);
  
  if (!room.ms_room_email) return; // Ingen Outlook-sync konfigureret
  
  const client = await getGraphClient(booking.org_id);
  
  const event = {
    subject: booking.title,
    start: { dateTime: booking.starts_at, timeZone: "Europe/Copenhagen" },
    end:   { dateTime: booking.ends_at,   timeZone: "Europe/Copenhagen" },
    location: { displayName: room.name },
    attendees: [
      {
        emailAddress: { address: room.ms_room_email },
        type: "resource",
      },
      ...await getUserEmails(booking.attendees),
    ],
  };
  
  let msEventId: string;
  if (booking.ms_event_id) {
    // Opdater eksisterende
    await client.api(`/me/events/${booking.ms_event_id}`).patch(event);
    msEventId = booking.ms_event_id;
  } else {
    // Opret ny
    const created = await client.api("/me/events").post(event);
    msEventId = created.id;
  }
  
  await db.query(
    `UPDATE bookings SET ms_event_id = $1, ms_sync_status = 'synced' WHERE id = $2`,
    [msEventId, bookingId]
  );
}

// Lyt på Graph webhooks (change notifications) for synkronisering den anden vej
// POST /api/webhooks/graph
export async function handleGraphNotification(req: Request) {
  // Validér notifikation
  // Find booking via ms_event_id
  // Opdater lokalt (tid, annullering) baseret på Graph-event
}
```

### 10.4 5-minutters notifikationer

```typescript
// Kører som et scheduled job (Azure Function timer trigger eller cron)
// Frekvens: hvert minut

export async function sendMeetingReminders() {
  const now = new Date();
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
  
  const upcomingBookings = await db.query(`
    SELECT b.*, r.name as room_name, array_agg(u.email) as attendee_emails
    FROM bookings b
    JOIN rooms r ON r.id = b.room_id
    JOIN users u ON u.id = ANY(b.attendees)
    WHERE b.starts_at BETWEEN $1 AND $2
      AND b.notification_sent = false
      AND b.deleted_at IS NULL
    GROUP BY b.id, r.name
  `, [now, fiveMinLater]);
  
  for (const booking of upcomingBookings.rows) {
    // Send via LiveKit data channel til alle attendees der er online
    await broadcastNotification(booking.org_id, booking.attendees, {
      type: "meeting_reminder",
      bookingId: booking.id,
      roomName: booking.room_name,
      startsAt: booking.starts_at,
    });
    
    await db.query(
      `UPDATE bookings SET notification_sent = true WHERE id = $1`,
      [booking.id]
    );
  }
}
```

---

## 11. Infrastruktur og hosting

### 11.1 Azure-arkitektur

```
Azure Subscription: virtualoffice-prod
├── Resource Group: rg-virtualoffice-prod
│   ├── App Service Plan: asp-virtualoffice (P2v3, 2 vCPU, 8GB, auto-scale 1-5)
│   ├── App Service: app-virtualoffice (Next.js)
│   ├── Azure Database for PostgreSQL Flexible Server
│   │   ├── SKU: Standard_D2ds_v4 (2 vCPU, 8GB)
│   │   ├── Storage: 128GB, auto-grow
│   │   └── Backup: 7 dage, geo-redundant
│   ├── Azure Blob Storage: st-virtualoffice
│   │   ├── Container: avatars (public read)
│   │   ├── Container: desk-photos (public read)
│   │   └── Container: map-assets (public read)
│   ├── Azure Key Vault: kv-virtualoffice (secrets)
│   ├── Azure CDN: cdn-virtualoffice (static assets)
│   └── Application Insights: ai-virtualoffice
│
├── Resource Group: rg-livekit-prod (separat for isolation)
│   ├── Virtual Machine: vm-livekit (Standard_D2s_v3, Ubuntu 22.04)
│   ├── Network Security Group (port 7880 TCP+UDP åbent)
│   └── Public IP: statisk
│
└── Resource Group: rg-virtualoffice-dev
    └── (identisk setup, men B1/B2 SKUs)
```

### 11.2 LiveKit self-hosted setup

```yaml
# /etc/livekit/config.yaml (på Azure VM)
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

redis:
  address: localhost:6379

room:
  auto_create: true
  empty_timeout: 300      # 5 min inaktivitet → luk rum
  max_participants: 200

logging:
  level: info
  json: true
```

**Systemd service:**
```ini
[Unit]
Description=LiveKit Server
After=network.target

[Service]
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit/config.yaml
Restart=always
User=livekit

[Install]
WantedBy=multi-user.target
```

### 11.3 Miljøvariabler

```bash
# Produktion (Azure Key Vault → App Service Config)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<32-byte random>
NEXTAUTH_URL=https://virtualoffice.app

# Azure AD
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=common

# LiveKit
LIVEKIT_URL=wss://livekit.virtualoffice.app:7880
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.virtualoffice.app:7880

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Azure Blob
AZURE_STORAGE_ACCOUNT=stvirtualoffice
AZURE_STORAGE_KEY=...
AZURE_CDN_URL=https://cdn.virtualoffice.app

# Kryptering (til Graph refresh tokens)
ENCRYPTION_KEY=<32-byte hex>
```

### 11.4 CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci && npm run build
      - uses: azure/webapps-deploy@v3
        with:
          app-name: app-virtualoffice
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

**Database migrations:**
- Brug `node-pg-migrate` eller Drizzle ORM migrations
- Migrations køres automatisk ved deploy: `npm run db:migrate`
- Aldrig destruktive migrations i production uden explicit review

---

## 12. Roadmap

### 12.1 MVP — Fase 1 (estimat: 8-10 uger)

**Mål:** 2care4-pilot kan køre. Grundlæggende kontor-oplevelse.

| Feature | Estimat |
|---------|---------|
| Next.js projekt setup, auth (begge flows), DB-skema | 1 uge |
| Phaser.js map-rendering fra Tiled JSON, avatar-bevægelse | 1,5 uge |
| LiveKit integration: floor audio, spatial volume | 1,5 uge |
| Mødelokale-isolation (separat LiveKit room ved indgang) | 0,5 uge |
| Presence-system: online/available/busy/DND, busy light | 0,5 uge |
| Personligt bord + dekoration (farver, foto, tema) | 0,5 uge |
| Multi-tenant: org-signup, subdomain routing, seat-check | 1 uge |
| Stripe: Starter (gratis) + Team-plan, checkout | 1 uge |
| Microsoft SSO (Azure AD MSAL) | 0,5 uge |
| Pilot-opsætning: 2care4 map, brugere, Azure AD sync | 0,5 uge |
| **Total** | **~8,5 uge** |

**MVP ikke-inkluderet (bevidste fravalg):**
- Built-in map editor (admin uploader Tiled JSON manuelt)
- Microsoft Graph rum-sync
- Interaktionssystem
- Business-plan features

### 12.2 V2 — Fase 2 (estimat: 5-6 uger efter MVP-launch)

**Mål:** Interaktion, rumreservation, professionelt onboarding.

| Feature | Estimat |
|---------|---------|
| Built-in Map Editor (react-konva) | 2 uger |
| Rumreservation: kalendervisning, booking-UI | 1 uge |
| Microsoft Graph integration (valgfri Outlook-sync) | 1 uge |
| Interaktionssystem: "Sig hej", "Giv noget", simpel chat | 1 uge |
| Business-plan: custom map, prioriteret support | 0,5 uge |
| **Total** | **~5,5 uge** |

### 12.3 V3 — Fase 3 (estimat: 4-5 uger)

**Mål:** Engagement og gamification.

| Feature | Estimat |
|---------|---------|
| Mini-games: Rock-paper-scissors, typing race | 1,5 uge |
| Trofæer og leaderboard | 1 uge |
| Avancerede avatar-customization | 0,5 uge |
| Team-zones: team_manager kan dekorere eget område | 0,5 uge |
| Notifikationer: webapp push notifications | 0,5 uge |
| **Total** | **~4 uge** |

### 12.4 V4 — Fase 4 (estimat: 6-8 uger)

**Mål:** Enterprise-features og skalering.

| Feature | Estimat |
|---------|---------|
| Mobile-app (React Native, iOS + Android) | 3 uger |
| SAML/SSO for non-Microsoft identity providers | 1 uge |
| Avanceret analytics: presence-data, mødefrekvens | 1 uge |
| API til 3. parts integrationer (Slack, Teams) | 1 uge |
| White-label option | 1 uge |
| **Total** | **~7 uge** |

### 12.5 Samlet tidslinje

```
Uge 1-9:   MVP → 2care4 pilot
Uge 10-11: Pilot feedback + rettelser
Uge 12-17: V2 → public launch
Uge 18-21: V3
Uge 22-29: V4
```

---

## 13. Sikkerhed

### 13.1 Tenant isolation

**Databasis-lag:**
- Alle queries sætter `SET app.current_org_id` før execution
- Row-Level Security policies på alle org-scoped tabeller
- Separate DB-connection pools per org er IKKE implementeret i MVP (acceptabel trade-off), men overvejes i V4

**API-lag:**
- Middleware validerer at URL-slug matcher JWT-claim
- Alle API handlers læser `x-org-id` fra trusted header (sat af middleware, ikke klient)
- Ingen direkte ID-opslag uden org_id-filter:

```typescript
// FORKERT (tillader cross-tenant access):
const room = await db.query(`SELECT * FROM rooms WHERE id = $1`, [roomId]);

// KORREKT:
const room = await db.query(
  `SELECT * FROM rooms WHERE id = $1 AND org_id = $2`,
  [roomId, orgId]
);
```

### 13.2 Auth-sikkerhed

- JWT-secret roteres månedligt (Azure Key Vault rotation policy)
- httpOnly, Secure, SameSite=Lax cookies
- CSRF-beskyttelse via NextAuth's built-in token validation
- Bcrypt rounds=12 (ca. 250ms/hash — balanceret mod brute-force)
- Rate limiting på auth-endpoints: 10 forsøg/minut per IP (via Azure API Management eller middleware)
- Email-verifikation tvungen før login
- Password reset tokens: UUID v4, 1 times udløb, single-use

### 13.3 LiveKit-sikkerhed

- Access tokens udstedes **kun server-side** (secret forlader aldrig klienten)
- Token TTL: 4 timer (genforhandles automatisk)
- Room-names indeholder org_id — krydstenant-adgang er umulig uden token
- LiveKit server er bag Azure NSG: kun port 7880 (WebSocket/WebRTC) er åbent

### 13.4 Filupload-sikkerhed

- Avatar og desk-fotos uploades via signed Azure Blob SAS URLs (kort levetid: 15 min)
- Filtype-validering: kun JPEG, PNG, WebP
- Max filstørrelse: 5MB avatarer, 10MB desk-fotos
- Malware-scanning via Azure Defender for Storage

### 13.5 GDPR-overvejelser

**Dataklassifikation:**

| Data | Klassifikation | Handling |
|------|----------------|----------|
| Email, navn | Persondata | Krypteret i transit (TLS 1.3), adgangskontrol |
| Avatar-billeder | Persondata | Brugerstyret, kan slettes |
| Positionsdata (tiles) | Persondata | Kun gemt i `presence`-tabel, real-time, ikke historik** |
| Bookinger | Forretningsdata | Gemmes 2 år, herefter slettet |
| Lyd-streams | Ikke gemt | Aldrig persisteret — kun real-time relay via LiveKit |

** Positionshistorik gemmes **ikke** i MVP — kun nuværende position. Analytics i V4 vil kræve separat GDPR-vurdering.

**Datapolitik:**
- Right to erasure: `DELETE /api/app/me` sletter user-record og anonymiserer booking-historik
- Data portability: `GET /api/app/me/export` returnerer brugerens data som JSON
- Data residency: al data gemmes i Azure North Europe (Dublin) — relevant for danske virksomheder under GDPR

**Databehandleraftale (DPA):**
- VirtualOffice agerer som databehandler for kunden (org admin er dataansvarlig)
- Standard DPA-skabelon inkluderes i signup-flow

### 13.6 Dependency- og infra-sikkerhed

- `npm audit` køres i CI — critical/high vulnerabilities bloker deploy
- Dependabot aktiveret for automatisk dependency-opdateringer
- Azure Defender for App Service aktiveret
- Ingen secrets i kode/git — alle via Azure Key Vault
- HTTPS tvungen via Azure App Service TLS policy (TLS 1.2 minimum)
- Content Security Policy header for at blokere XSS

---

*Dokument slut. Næste skridt: review med teknisk lead og 2care4-stakeholders, herefter sprint-planlægning for MVP.*
