"use client";

// VirtualOffice — Teams meeting button component (top bar)
// Shows meeting status indicator + quick start/join meeting controls.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MeetingRoom, MeetingStatus } from "@/lib/db";
import { useMeetingStatus } from "@/hooks/useTeamsMeetings";

const COLOURS = {
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
  green: "#4caf50",
  red: "#ef5350",
  amber: "#ffa726",
  bg: "#1a1d23",
  teamsPurple: "#6264A7",
};

export interface TeamsMeetingButtonProps {
  currentRoomId: string | undefined;
  meetings: MeetingRoom[];
  onCreateMeeting: (roomId: string) => void;
  onJoinMeeting: (joinUrl: string) => void;
  creating: boolean;
}

export default function TeamsMeetingButton({
  currentRoomId,
  meetings,
  onCreateMeeting,
  onJoinMeeting,
  creating,
}: TeamsMeetingButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentMeeting = currentRoomId
    ? meetings.find((m) => m.room_id === currentRoomId)
    : null;

  // Dropdown toggling
  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          background: currentMeeting
            ? COLOURS.teamsPurple
            : COLOURS.surface,
          color: currentMeeting ? "#fff" : COLOURS.text,
          border: `1px solid ${currentMeeting ? COLOURS.teamsPurple : COLOURS.border}`,
        }}
      >
        <TeamsIcon />
        {currentMeeting ? "I møde" : "Teams"}
        {currentRoomId && !currentMeeting && (
          <span
            className="ml-1 inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: COLOURS.amber }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg z-50"
          style={{
            background: COLOURS.surface,
            border: `1px solid ${COLOURS.border}`,
            maxHeight: "400px",
            overflow: "auto",
          }}
        >
          {/* Current room meeting */}
          {currentRoomId && (
            <div className="p-3 border-b" style={{ borderColor: COLOURS.border }}>
              <div className="text-xs mb-2" style={{ color: COLOURS.textDim }}>
                {currentRoomId ? `Rum: ${currentRoomId}` : "Vælg et mødelokale"}
              </div>
              {currentMeeting ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium" style={{ color: COLOURS.text }}>
                    {currentMeeting.subject}
                  </div>
                  <div className="text-xs" style={{ color: COLOURS.textDim }}>
                    Oprettet af {currentMeeting.created_by_name}
                  </div>
                  <button
                    onClick={() => {
                      onJoinMeeting(currentMeeting.join_web_url);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-1.5 rounded text-xs font-medium transition-colors"
                    style={{
                      background: COLOURS.teamsPurple,
                      color: "#fff",
                    }}
                  >
                    Deltag via Teams
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onCreateMeeting(currentRoomId);
                    setOpen(false);
                  }}
                  disabled={creating}
                  className="w-full px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: COLOURS.accent,
                    color: "#fff",
                  }}
                >
                  {creating ? "Opretter..." : "Start Teams møde"}
                </button>
              )}
            </div>
          )}

          {/* Active meetings list */}
          <div className="p-3">
            <div className="text-xs font-medium mb-2" style={{ color: COLOURS.textDim }}>
              Aktive møder
            </div>
            {meetings.length === 0 ? (
              <div className="text-xs" style={{ color: COLOURS.textDim }}>
                Ingen aktive møder
              </div>
            ) : (
              <div className="space-y-2">
                {meetings.map((m) => (
                  <div
                    key={m.meeting_id}
                    className="p-2 rounded"
                    style={{
                      background:
                        m.room_id === currentRoomId
                          ? "rgba(98,100,167,0.15)"
                          : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: COLOURS.text }}>
                      {m.subject}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: COLOURS.textDim }}>
                      {m.room_id} · {m.created_by_name}
                    </div>
                    <button
                      onClick={() => {
                        onJoinMeeting(m.join_web_url);
                        setOpen(false);
                      }}
                      className="mt-1.5 px-2 py-1 rounded text-xs transition-colors"
                      style={{
                        background: "rgba(98,100,167,0.3)",
                        color: COLOURS.text,
                      }}
                    >
                      Deltag
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status control */}
          <div className="p-3 border-t" style={{ borderColor: COLOURS.border }}>
            <div className="text-xs mb-2" style={{ color: COLOURS.textDim }}>
              Din status
            </div>
            <StatusControl />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Teams icon ───────────────────────────────────────────────────────────

function TeamsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#6264A7" />
      <path d="M28 16h-6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V18c0-1.1-.9-2-2-2zm11 5h-3c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1zm0-4h-3c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1z" fill="#fff" />
      <circle cx="16" cy="20" r="3" fill="#fff" />
    </svg>
  );
}

// ── Status control ───────────────────────────────────────────────────────

function StatusControl() {
  const userId = useMemo(() => {
    if (typeof window !== "undefined") {
      let hash = 0;
      const name = localStorage.getItem("virtual-office-name") ?? "guest";
      for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
      }
      return `user-${Math.abs(hash).toString(16).slice(0, 8)}`;
    }
    return "";
  }, []);

  const { status, setStatus } = useMeetingStatus(userId);

  return (
    <div className="flex gap-1">
      {(["available", "in_meeting", "busy"] as MeetingStatus[]).map((s) => (
        <button
          key={s}
          onClick={() => setStatus(s)}
          className="flex-1 px-2 py-1 rounded text-xs transition-colors"
          style={{
            background: status === s ? getStatusColor(s) : "transparent",
            color: status === s ? "#fff" : COLOURS.textDim,
            border: `1px solid ${status === s ? getStatusColor(s) : COLOURS.border}`,
          }}
        >
          {statusLabel(s)}
        </button>
      ))}
    </div>
  );
}

function getStatusColor(s: MeetingStatus): string {
  switch (s) {
    case "available":
      return COLOURS.green;
    case "in_meeting":
      return COLOURS.teamsPurple;
    case "busy":
      return COLOURS.red;
  }
}

function statusLabel(s: MeetingStatus): string {
  switch (s) {
    case "available":
      return "Ledig";
    case "in_meeting":
      return "I møde";
    case "busy":
      return "Optaget";
  }
}

