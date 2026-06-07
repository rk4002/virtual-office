"use client";

// VirtualOffice — Presence Panel
// Sidebar panel showing online users with avatar initials, name, position,
// and online status indicator. Drives from the SSE presence stream.

import type { PresenceUser } from "@/hooks/usePresence";
import type { MeetingStatus } from "@/lib/db";

// ── Colour constants (matching OfficeCanvas theme) ─────────────────────────

const COLOURS = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
  green: "#4caf50",
  red: "#ef5350",
  amber: "#ffa726",
};

// Avatar colour palette for deterministic per-user colours
const AVATAR_COLOURS = [
  "#5b9bd5", "#4caf50", "#ffa726", "#ef5350",
  "#ab47bc", "#26c6da", "#ec407a", "#7e57c2",
  "#66bb6a", "#42a5f5", "#ff7043", "#8d6e63",
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface PresencePanelProps {
  users: PresenceUser[];
  meetingStatuses: Map<string, MeetingStatus>;
  currentUserId: string;
}

// ── Meeting status badge ────────────────────────────────────────────────────

function MeetingStatusBadge({ status }: { status: MeetingStatus | undefined }) {
  if (!status || status === "available") return null;

  const isInMeeting = status === "in_meeting";
  return (
    <span
      className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded flex-shrink-0"
      style={{
        background: isInMeeting ? "rgba(98,100,167,0.2)" : "rgba(239,83,80,0.15)",
        color: isInMeeting ? "#6264A7" : COLOURS.red,
        letterSpacing: "0.02em",
      }}
    >
      {isInMeeting ? "I møde" : "Optaget"}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PresencePanel({ users, meetingStatuses, currentUserId }: PresencePanelProps) {
  const others = users.filter((u) => u.user_id !== currentUserId);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: COLOURS.surface, borderLeft: `1px solid ${COLOURS.border}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${COLOURS.border}` }}
      >
        <h2 className="text-sm font-semibold" style={{ color: COLOURS.text }}>
          Online ({others.length})
        </h2>
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: COLOURS.green }}
        />
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {others.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: COLOURS.textDim }}>
              Ingen andre online
            </p>
            <p className="text-xs mt-1" style={{ color: COLOURS.textDim }}>
              Inviter dine kolleger til kontoret!
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: COLOURS.border }}>
            {others.map((user) => (
              <li
                key={user.user_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-black/10 transition-colors"
              >
                {/* Avatar circle */}
                <div
                  className="relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: avatarColor(user.user_id) }}
                >
                  <span className="text-xs font-bold text-white">
                    {initials(user.name)}
                  </span>
                  {/* Online dot */}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 flex-shrink-0"
                    style={{
                      background: COLOURS.green,
                      borderColor: COLOURS.surface,
                    }}
                  />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: COLOURS.text }}
                    >
                      {user.name}
                    </p>
                    {/* Meeting status badge */}
                    <MeetingStatusBadge status={meetingStatuses.get(user.user_id)} />
                  </div>
                  <p
                    className="text-xs truncate"
                    style={{ color: COLOURS.textDim }}
                  >
                    {user.email}
                  </p>
                </div>

                {/* Position hint */}
                <span className="text-xs flex-shrink-0" style={{ color: COLOURS.textDim }}>
                  ({Math.round(user.x)}, {Math.round(user.y)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer — self status */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center gap-2"
        style={{ borderTop: `1px solid ${COLOURS.border}` }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: COLOURS.green }}
        />
        <span className="text-xs" style={{ color: COLOURS.textDim }}>
          Du er online
        </span>
      </div>
    </div>
  );
}