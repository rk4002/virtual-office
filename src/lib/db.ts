// VirtualOffice — Vercel Postgres client + schema helpers
// Provides typed DB access for office layouts and room configurations.

import { sql } from "@vercel/postgres";

// ── Layout types ──────────────────────────────────────────────────────────

export interface OfficeLayout {
  id: string;
  name: string;
  floor_width: number;
  floor_height: number;
  rooms: LayoutRoom[];
  created_at: string;
  updated_at: string;
}

export interface LayoutRoom {
  id: string;
  name: string;
  type: "meeting" | "focus" | "social" | "open";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LayoutRow = {
  id: string;
  name: string;
  floor_width: number;
  floor_height: number;
  rooms_json: LayoutRoom[];
  created_at: Date;
  updated_at: Date;
};

// ── Schema initialisation ─────────────────────────────────────────────────

export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS office_layouts (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      floor_width   INTEGER NOT NULL DEFAULT 2400,
      floor_height  INTEGER NOT NULL DEFAULT 1350,
      rooms_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Index on name for fast lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_office_layouts_name
    ON office_layouts (name);
  `;
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function getAllLayouts(): Promise<OfficeLayout[]> {
  const { rows } = await sql<LayoutRow>`
    SELECT * FROM office_layouts ORDER BY updated_at DESC
  `;
  return rows.map(rowToLayout);
}

export async function getLayout(id: string): Promise<OfficeLayout | null> {
  const { rows } = await sql<LayoutRow>`
    SELECT * FROM office_layouts WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  return rowToLayout(rows[0]);
}

export async function createLayout(
  name: string,
  floorWidth: number = 2400,
  floorHeight: number = 1350,
  rooms: LayoutRoom[] = [],
): Promise<OfficeLayout> {
  const { rows } = await sql<LayoutRow>`
    INSERT INTO office_layouts (name, floor_width, floor_height, rooms_json)
    VALUES (${name}, ${floorWidth}, ${floorHeight}, ${JSON.stringify(rooms)}::jsonb)
    RETURNING *
  `;
  return rowToLayout(rows[0]);
}

export async function updateLayout(
  id: string,
  updates: {
    name?: string;
    floor_width?: number;
    floor_height?: number;
    rooms?: LayoutRoom[];
  },
): Promise<OfficeLayout | null> {
  const current = await getLayout(id);
  if (!current) return null;

  const name = updates.name ?? current.name;
  const floorWidth = updates.floor_width ?? current.floor_width;
  const floorHeight = updates.floor_height ?? current.floor_height;
  const rooms = updates.rooms ?? current.rooms;

  const { rows } = await sql<LayoutRow>`
    UPDATE office_layouts
    SET name = ${name},
        floor_width = ${floorWidth},
        floor_height = ${floorHeight},
        rooms_json = ${JSON.stringify(rooms)}::jsonb,
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return rowToLayout(rows[0]);
}

export async function deleteLayout(id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM office_layouts WHERE id = ${id}
  `;
  return (rowCount ?? 0) > 0;
}

// ── Presence types ─────────────────────────────────────────────────────────

export interface PresenceUser {
  user_id: string;
  name: string;
  email: string;
  x: number;
  y: number;
  last_seen: string;
  online: boolean;
}

type PresenceRow = {
  user_id: string;
  name: string;
  email: string;
  x: number;
  y: number;
  last_seen: Date;
  online: boolean;
};

// ── Presence schema init ────────────────────────────────────────────────────

export async function initPresenceSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS presence (
      user_id  TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      email    TEXT NOT NULL,
      x        FLOAT8 NOT NULL DEFAULT 0,
      y        FLOAT8 NOT NULL DEFAULT 0,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      online   BOOLEAN NOT NULL DEFAULT false
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_presence_online
    ON presence (online) WHERE online = TRUE;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_presence_last_seen
    ON presence (last_seen);
  `;
}

// ── Presence CRUD ──────────────────────────────────────────────────────────

const PRESENCE_TTL_SECONDS = 15; // users stale after 15s without heartbeat

export async function heartbeatPresence(
  userId: string,
  name: string,
  email: string,
  x: number,
  y: number,
): Promise<void> {
  await sql`
    INSERT INTO presence (user_id, name, email, x, y, last_seen, online)
    VALUES (${userId}, ${name}, ${email}, ${x}, ${y}, now(), TRUE)
    ON CONFLICT (user_id) DO UPDATE SET
      name      = ${name},
      email     = ${email},
      x         = ${x},
      y         = ${y},
      last_seen = now(),
      online    = TRUE;
  `;
}

export async function markOffline(userId: string): Promise<void> {
  await sql`
    UPDATE presence
    SET online = FALSE
    WHERE user_id = ${userId};
  `;
}

/** Reap stale users (last_seen > TTL) + return current online users */
export async function getOnlineUsers(): Promise<PresenceUser[]> {
  // First, mark stale users offline
  await sql`
    UPDATE presence
    SET online = FALSE
    WHERE online = TRUE
      AND last_seen < now() - make_interval(secs => ${PRESENCE_TTL_SECONDS});
  `;

  const { rows } = await sql<PresenceRow>`
    SELECT * FROM presence
    WHERE online = TRUE
    ORDER BY name ASC;
  `;

  return rows.map((r) => ({
    user_id: r.user_id,
    name: r.name,
    email: r.email,
    x: r.x,
    y: r.y,
    last_seen: new Date(r.last_seen).toISOString(),
    online: r.online,
  }));
}

// ── Chat types ─────────────────────────────────────────────────────────────────

export type ChatScope = "room" | "private";

export interface ChatMessage {
  id: string;
  scope: ChatScope;
  room_id: string | null;       // null for private messages
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;  // null for room messages
  text: string;
  x: number;                    // sender position when sent
  y: number;
  created_at: string;
  expires_at: string | null;    // auto-expire after TTL
}

type ChatMessageRow = {
  id: string;
  scope: string;
  room_id: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  text: string;
  x: number;
  y: number;
  created_at: Date;
  expires_at: Date | null;
};

// ── Chat schema init ────────────────────────────────────────────────────────

const CHAT_MESSAGE_TTL_SECONDS = 300; // messages auto-expire after 5 minutes

export async function initChatSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scope         TEXT NOT NULL DEFAULT 'room',
      room_id       TEXT,
      sender_id     TEXT NOT NULL,
      sender_name   TEXT NOT NULL,
      recipient_id  TEXT,
      text          TEXT NOT NULL,
      x             FLOAT8 NOT NULL DEFAULT 0,
      y             FLOAT8 NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at    TIMESTAMPTZ DEFAULT now() + make_interval(secs => ${CHAT_MESSAGE_TTL_SECONDS})
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created
    ON chat_messages (created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room
    ON chat_messages (room_id) WHERE scope = 'room';
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient
    ON chat_messages (recipient_id) WHERE scope = 'private';
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_active
    ON chat_messages (scope, room_id)
    WHERE expires_at > now();
  `;
}

// ── Chat CRUD ───────────────────────────────────────────────────────────────

/** Insert a new chat message. Returns the created message. */
export async function insertChatMessage(params: {
  scope: ChatScope;
  room_id?: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id?: string | null;
  text: string;
  x: number;
  y: number;
}): Promise<ChatMessage> {
  const { rows } = await sql<ChatMessageRow>`
    INSERT INTO chat_messages (scope, room_id, sender_id, sender_name, recipient_id, text, x, y)
    VALUES (
      ${params.scope},
      ${params.room_id ?? null},
      ${params.sender_id},
      ${params.sender_name},
      ${params.recipient_id ?? null},
      ${params.text},
      ${params.x},
      ${params.y}
    )
    RETURNING *;
  `;
  return rowToChatMessage(rows[0]);
}

/** Get recent chat messages (non-expired). 
 *  - room_id set → room messages for that room  
 *  - recipient_id + sender_id set → private DM between two users  
 *  - neither → all active messages (global feed)
 */
export async function getChatMessages(params?: {
  room_id?: string;
  participants?: [string, string]; // [userA, userB] for DM
}): Promise<ChatMessage[]> {
  if (params?.participants) {
    const [a, b] = params.participants;
    const { rows } = await sql<ChatMessageRow>`
      SELECT * FROM chat_messages
      WHERE scope = 'private'
        AND expires_at > now()
        AND (
          (sender_id = ${a} AND recipient_id = ${b})
          OR
          (sender_id = ${b} AND recipient_id = ${a})
        )
      ORDER BY created_at ASC
      LIMIT 200;
    `;
    return rows.map(rowToChatMessage);
  }

  if (params?.room_id) {
    const { rows } = await sql<ChatMessageRow>`
      SELECT * FROM chat_messages
      WHERE scope = 'room'
        AND room_id = ${params.room_id}
        AND expires_at > now()
      ORDER BY created_at ASC
      LIMIT 200;
    `;
    return rows.map(rowToChatMessage);
  }

  // All active (global)
  const { rows } = await sql<ChatMessageRow>`
    SELECT * FROM chat_messages
    WHERE expires_at > now()
    ORDER BY created_at DESC
    LIMIT 200;
  `;
  return rows.map(rowToChatMessage);
}

/** Clean up expired messages (called periodically by the SSE poll loop). */
export async function purgeExpiredMessages(): Promise<number> {
  const { rowCount } = await sql`
    DELETE FROM chat_messages WHERE expires_at <= now();
  `;
  return rowCount ?? 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    scope: row.scope as ChatScope,
    room_id: row.room_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    recipient_id: row.recipient_id,
    text: row.text,
    x: row.x,
    y: row.y,
    created_at: new Date(row.created_at).toISOString(),
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

function rowToLayout(row: LayoutRow): OfficeLayout {
  return {
    id: row.id,
    name: row.name,
    floor_width: row.floor_width,
    floor_height: row.floor_height,
    rooms: Array.isArray(row.rooms_json) ? row.rooms_json : [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ── Teams meeting rooms ────────────────────────────────────────────────────

export interface MeetingRoom {
  room_id: string;            // office room ID (e.g. "meeting-a")
  meeting_id: string;          // Microsoft Graph meeting ID
  join_web_url: string;        // Teams join URL
  subject: string;
  start_date_time: string;     // ISO 8601
  end_date_time: string;       // ISO 8601
  created_by: string;          // user_id of the creator
  created_by_name: string;
  created_at: string;          // ISO 8601
  active: boolean;
}

type MeetingRoomRow = {
  room_id: string;
  meeting_id: string;
  join_web_url: string;
  subject: string;
  start_date_time: string;
  end_date_time: string;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  active: boolean;
};

export async function initMeetingRoomsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS meeting_rooms (
      room_id         TEXT NOT NULL,
      meeting_id      TEXT PRIMARY KEY,
      join_web_url    TEXT NOT NULL,
      subject         TEXT NOT NULL,
      start_date_time TEXT NOT NULL,
      end_date_time   TEXT NOT NULL,
      created_by      TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      active          BOOLEAN NOT NULL DEFAULT TRUE
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_meeting_rooms_room
    ON meeting_rooms (room_id) WHERE active = TRUE;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_meeting_rooms_active
    ON meeting_rooms (active) WHERE active = TRUE;
  `;

  // Mark past meetings as inactive
  await sql`
    UPDATE meeting_rooms
    SET active = FALSE
    WHERE active = TRUE
      AND end_date_time < now()::text;
  `;
}

export async function createMeetingRoom(params: {
  room_id: string;
  meeting_id: string;
  join_web_url: string;
  subject: string;
  start_date_time: string;
  end_date_time: string;
  created_by: string;
  created_by_name: string;
}): Promise<MeetingRoom> {
  // Deactivate existing meetings in this room first
  await sql`
    UPDATE meeting_rooms SET active = FALSE
    WHERE room_id = ${params.room_id} AND active = TRUE;
  `;

  const { rows } = await sql<MeetingRoomRow>`
    INSERT INTO meeting_rooms
      (room_id, meeting_id, join_web_url, subject, start_date_time, end_date_time, created_by, created_by_name)
    VALUES
      (${params.room_id}, ${params.meeting_id}, ${params.join_web_url}, ${params.subject},
       ${params.start_date_time}, ${params.end_date_time}, ${params.created_by}, ${params.created_by_name})
    RETURNING *;
  `;
  return rowToMeetingRoom(rows[0]);
}

export async function getMeetingRoom(meetingId: string): Promise<MeetingRoom | null> {
  const { rows } = await sql<MeetingRoomRow>`
    SELECT * FROM meeting_rooms WHERE meeting_id = ${meetingId};
  `;
  if (rows.length === 0) return null;
  return rowToMeetingRoom(rows[0]);
}

export async function getMeetingRoomByRoomId(roomId: string): Promise<MeetingRoom | null> {
  const { rows } = await sql<MeetingRoomRow>`
    SELECT * FROM meeting_rooms
    WHERE room_id = ${roomId} AND active = TRUE
    ORDER BY created_at DESC LIMIT 1;
  `;
  if (rows.length === 0) return null;
  return rowToMeetingRoom(rows[0]);
}

export async function getAllActiveMeetings(): Promise<MeetingRoom[]> {
  // Clean up expired meetings
  await sql`
    UPDATE meeting_rooms SET active = FALSE
    WHERE active = TRUE AND end_date_time < now()::text;
  `;

  const { rows } = await sql<MeetingRoomRow>`
    SELECT * FROM meeting_rooms WHERE active = TRUE ORDER BY created_at DESC;
  `;
  return rows.map(rowToMeetingRoom);
}

export async function deactivateMeeting(meetingId: string): Promise<boolean> {
  const { rowCount } = await sql`
    UPDATE meeting_rooms SET active = FALSE WHERE meeting_id = ${meetingId};
  `;
  return (rowCount ?? 0) > 0;
}

// ── Presence meeting status ─────────────────────────────────────────────────

export async function updateMeetingStatus(
  userId: string,
  meetingStatus: "available" | "in_meeting" | "busy",
): Promise<void> {
  await sql`
    INSERT INTO presence_meeting_status (user_id, status, updated_at)
    VALUES (${userId}, ${meetingStatus}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      status = ${meetingStatus},
      updated_at = now();
  `;
}

export async function getUserMeetingStatus(
  userId: string,
): Promise<"available" | "in_meeting" | "busy" | null> {
  const { rows } = await sql<{ status: string }>`
    SELECT status FROM presence_meeting_status WHERE user_id = ${userId};
  `;
  if (rows.length === 0) return null;
  return rows[0].status as "available" | "in_meeting" | "busy";
}

export type MeetingStatus = "available" | "in_meeting" | "busy";

export interface MeetingStatusEntry {
  user_id: string;
  status: MeetingStatus;
  updated_at: string;
}

export async function getAllMeetingStatuses(): Promise<MeetingStatusEntry[]> {
  const { rows } = await sql<{ user_id: string; status: string; updated_at: Date }>`
    SELECT * FROM presence_meeting_status;
  `;
  return rows.map((r) => ({
    user_id: r.user_id,
    status: r.status as MeetingStatus,
    updated_at: new Date(r.updated_at).toISOString(),
  }));
}

export async function initMeetingStatusSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS presence_meeting_status (
      user_id    TEXT PRIMARY KEY,
      status     TEXT NOT NULL DEFAULT 'available',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

// ── Coffee Matches (virtual kaffemaskine) ────────────────────────────────────
//
// Hver dag matches online kollegaer tilfældigt til en virtuel kaffepause.
// Ét match per bruger per dag — når begge matcher hinanden markeres det som "mutual".

export interface CoffeeMatch {
  id: string;
  user_id: string;
  user_name: string;
  matched_user_id: string;
  matched_user_name: string;
  is_mutual: boolean;
  matched_at: string;
}

type CoffeeMatchRow = {
  id: string;
  user_id: string;
  user_name: string;
  matched_user_id: string;
  matched_user_name: string;
  is_mutual: boolean;
  matched_at: Date;
};

export async function initCoffeeMatchesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS coffee_matches (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           TEXT NOT NULL,
      user_name         TEXT NOT NULL,
      matched_user_id   TEXT NOT NULL,
      matched_user_name TEXT NOT NULL,
      is_mutual         BOOLEAN NOT NULL DEFAULT FALSE,
      matched_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_coffee_matches_user_date
    ON coffee_matches (user_id, matched_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_coffee_matches_mutual
    ON coffee_matches (is_mutual) WHERE is_mutual = TRUE;
  `;
}

/** Opret et kaffematch for en bruger — vælger en tilfældig online kollega.
 *  Hvis den valgte kollega allerede har matchet afsenderen, markeres begge som mutual.
 *  En bruger får kun ét match per dag (matched_at >= midnight UTC). */
export async function createCoffeeMatch(
  userId: string,
  userName: string,
  onlineUsers: { user_id: string; name: string }[],
): Promise<CoffeeMatch> {
  // Check for existing today-match
  const existing = await getTodayCoffeeMatch(userId);
  if (existing) return existing;

  // Find candidates: online users excluding self
  const candidates = onlineUsers.filter((u) => u.user_id !== userId);
  if (candidates.length === 0) {
    throw new Error("Ingen online kollegaer at matche med");
  }

  // Pick a random candidate
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  // Check if the picked user already matched us today — if so, make it mutual
  let isMutual = false;
  const theirMatch = await getTodayCoffeeMatch(picked.user_id);
  if (theirMatch && theirMatch.matched_user_id === userId) {
    isMutual = true;
    // Mark their match as mutual too
    await sql`
      UPDATE coffee_matches
      SET is_mutual = TRUE
      WHERE id = ${theirMatch.id};
    `;
  }

  const { rows } = await sql<CoffeeMatchRow>`
    INSERT INTO coffee_matches (user_id, user_name, matched_user_id, matched_user_name, is_mutual)
    VALUES (${userId}, ${userName}, ${picked.user_id}, ${picked.name}, ${isMutual})
    RETURNING *;
  `;

  return rowToCoffeeMatch(rows[0]);
}

/** Hent dagens kaffematch for en given bruger (matched_at >= dagens start UTC). */
export async function getTodayCoffeeMatch(userId: string): Promise<CoffeeMatch | null> {
  const { rows } = await sql<CoffeeMatchRow>`
    SELECT * FROM coffee_matches
    WHERE user_id = ${userId}
      AND matched_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    ORDER BY matched_at DESC
    LIMIT 1;
  `;
  if (rows.length === 0) return null;
  return rowToCoffeeMatch(rows[0]);
}

function rowToCoffeeMatch(row: CoffeeMatchRow): CoffeeMatch {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    matched_user_id: row.matched_user_id,
    matched_user_name: row.matched_user_name,
    is_mutual: row.is_mutual,
    matched_at: new Date(row.matched_at).toISOString(),
  };
}

// ── Chat Reactions ──────────────────────────────────────────────────────────

export interface ChatReaction {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

type ChatReactionRow = {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  user_name: string;
  created_at: Date;
};

export interface AggregatedReaction {
  emoji: string;
  count: number;
  users: string[];  // user_ids who reacted with this emoji
}

export async function initChatReactionsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      emoji       TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      user_name   TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(message_id, emoji, user_id)
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
    ON chat_reactions (message_id);
  `;
}

/** Toggle a reaction — add if not exists, remove if it does. Returns the new set of reactions for this message. */
export async function toggleReaction(params: {
  message_id: string;
  emoji: string;
  user_id: string;
  user_name: string;
}): Promise<{ action: "added" | "removed"; reactions: AggregatedReaction[] }> {
  // Try to delete first
  const delResult = await sql`
    DELETE FROM chat_reactions
    WHERE message_id = ${params.message_id}
      AND emoji = ${params.emoji}
      AND user_id = ${params.user_id}
  `;

  if ((delResult.rowCount ?? 0) > 0) {
    // Removed — return remaining aggregates
    const reactions = await getReactionsForMessage(params.message_id);
    return { action: "removed", reactions };
  }

  // Insert new reaction
  await sql`
    INSERT INTO chat_reactions (message_id, emoji, user_id, user_name)
    VALUES (${params.message_id}, ${params.emoji}, ${params.user_id}, ${params.user_name})
    ON CONFLICT (message_id, emoji, user_id) DO NOTHING;
  `;

  const reactions = await getReactionsForMessage(params.message_id);
  return { action: "added", reactions };
}

/** Get aggregated reactions for a single message */
export async function getReactionsForMessage(message_id: string): Promise<AggregatedReaction[]> {
  const { rows } = await sql<{ emoji: string; count: string; users: string }>`
    SELECT
      emoji,
      COUNT(*)::text AS count,
      ARRAY_AGG(user_id ORDER BY created_at ASC)::text AS users
    FROM chat_reactions
    WHERE message_id = ${message_id}
    GROUP BY emoji
    ORDER BY COUNT(*) DESC, emoji ASC;
  `;

  return rows.map((r) => ({
    emoji: r.emoji,
    count: parseInt(r.count, 10),
    users: parsePostgresArray(r.users),
  }));
}

/** Get reactions for multiple messages (batch fetch). Returns a Map<message_id, AggregatedReaction[]> */
export async function getReactionsForMessages(message_ids: string[]): Promise<Map<string, AggregatedReaction[]>> {
  if (message_ids.length === 0) return new Map();

  // Build ANY clause with individual parameters — @vercel/postgres doesn't support arrays
  const placeholders = message_ids.map((_, i) => `$${i + 1}`).join(", ");
  const query = `
    SELECT
      message_id,
      emoji,
      COUNT(*)::text AS count,
      ARRAY_AGG(user_id ORDER BY created_at ASC)::text AS users
    FROM chat_reactions
    WHERE message_id = ANY(ARRAY[${placeholders}]::uuid[])
    GROUP BY message_id, emoji
    ORDER BY message_id, COUNT(*) DESC, emoji ASC;
  `;

  const { rows } = await sql.query<{ message_id: string; emoji: string; count: string; users: string }>(
    query,
    message_ids,
  );

  const result = new Map<string, AggregatedReaction[]>();
  for (const row of rows) {
    const entry: AggregatedReaction = {
      emoji: row.emoji,
      count: parseInt(row.count, 10),
      users: parsePostgresArray(row.users),
    };
    const existing = result.get(row.message_id);
    if (existing) {
      existing.push(entry);
    } else {
      result.set(row.message_id, [entry]);
    }
  }
  return result;
}

/** Parse a Postgres array literal like {a,b,c} into a string array */
function parsePostgresArray(pgArray: string): string[] {
  if (!pgArray || pgArray === "{}") return [];
  return pgArray.slice(1, -1).split(",").map((s) => s.trim());
}

// ── Meeting Summaries (AI-genereret møde-opsummering) ──────────────────────
//
// Når et møde afsluttes, samles alle chat-beskeder fra rummet og sendes til en
// LLM (OpenAI-kompatibel API) som genererer et struktureret resumé på dansk.

export interface MeetingSummary {
  id: string;
  room_id: string;
  room_name: string;
  requested_by: string;       // user_id
  requested_by_name: string;
  summary: string;             // LLM-genereret resumé (markdown)
  message_count: number;       // antal beskeder brugt som input
  created_at: string;
}

type MeetingSummaryRow = {
  id: string;
  room_id: string;
  room_name: string;
  requested_by: string;
  requested_by_name: string;
  summary: string;
  message_count: number;
  created_at: Date;
};

export async function initMeetingSummariesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS meeting_summaries (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id           TEXT NOT NULL,
      room_name         TEXT NOT NULL,
      requested_by      TEXT NOT NULL,
      requested_by_name TEXT NOT NULL,
      summary           TEXT NOT NULL,
      message_count     INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_meeting_summaries_room
    ON meeting_summaries (room_id, created_at DESC);
  `;
}

export async function saveMeetingSummary(params: {
  room_id: string;
  room_name: string;
  requested_by: string;
  requested_by_name: string;
  summary: string;
  message_count: number;
}): Promise<MeetingSummary> {
  const { rows } = await sql<MeetingSummaryRow>`
    INSERT INTO meeting_summaries (room_id, room_name, requested_by, requested_by_name, summary, message_count)
    VALUES (${params.room_id}, ${params.room_name}, ${params.requested_by}, ${params.requested_by_name}, ${params.summary}, ${params.message_count})
    RETURNING *;
  `;
  return rowToMeetingSummary(rows[0]);
}

export async function getMeetingSummaries(
  room_id: string,
  limit: number = 5,
): Promise<MeetingSummary[]> {
  const { rows } = await sql<MeetingSummaryRow>`
    SELECT * FROM meeting_summaries
    WHERE room_id = ${room_id}
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return rows.map(rowToMeetingSummary);
}

export async function getLatestMeetingSummary(
  room_id: string,
): Promise<MeetingSummary | null> {
  const { rows } = await sql<MeetingSummaryRow>`
    SELECT * FROM meeting_summaries
    WHERE room_id = ${room_id}
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  if (rows.length === 0) return null;
  return rowToMeetingSummary(rows[0]);
}

function rowToMeetingSummary(row: MeetingSummaryRow): MeetingSummary {
  return {
    id: row.id,
    room_id: row.room_id,
    room_name: row.room_name,
    requested_by: row.requested_by,
    requested_by_name: row.requested_by_name,
    summary: row.summary,
    message_count: row.message_count,
    created_at: new Date(row.created_at).toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rowToMeetingRoom(row: MeetingRoomRow): MeetingRoom {
  return {
    room_id: row.room_id,
    meeting_id: row.meeting_id,
    join_web_url: row.join_web_url,
    subject: row.subject,
    start_date_time: row.start_date_time,
    end_date_time: row.end_date_time,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: new Date(row.created_at).toISOString(),
    active: row.active,
  };
}