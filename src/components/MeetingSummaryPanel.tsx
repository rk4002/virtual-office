"use client";

// VirtualOffice — Meeting Summary Panel
// Triggers AI-generated meeting summaries from room chat, and displays past summaries.
// Works alongside the chat panel — uses the /api/meetings/summarize endpoint.

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage, MeetingSummary } from "@/lib/db";

// ── Colour constants ────────────────────────────────────────────────────────

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

// ── Props ───────────────────────────────────────────────────────────────────

export interface MeetingSummaryPanelProps {
  roomId: string | null;
  roomName: string | null;
  isInMeetingRoom: boolean;
  messages: ChatMessage[];
  userId: string;
  userName: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MeetingSummaryPanel({
  roomId,
  roomName,
  isInMeetingRoom,
  messages,
  userId,
  userName,
}: MeetingSummaryPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState<MeetingSummary | null>(null);
  const [pastSummaries, setPastSummaries] = useState<MeetingSummary[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const fetchedRoomRef = useRef<string | null>(null);

  // Auto-fetch latest summary when entering a new meeting room
  useEffect(() => {
    if (!roomId || !isInMeetingRoom) {
      setLatestSummary(null);
      setPastSummaries([]);
      setShowPanel(false);
      fetchedRoomRef.current = null;
      return;
    }

    // Only fetch when roomId changes
    if (fetchedRoomRef.current === roomId) return;
    fetchedRoomRef.current = roomId;

    setMessageCount(messages.length);

    fetch(`/api/meetings/summarize?room_id=${encodeURIComponent(roomId)}&limit=5`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.summaries?.length > 0) {
          setLatestSummary(data.summaries[0]);
          setPastSummaries(data.summaries.slice(1));
        }
      })
      .catch(() => {
        // silently ignore — user can still generate
      });
  }, [roomId, isInMeetingRoom, messages.length]);

  // Generate a new meeting summary
  const handleGenerate = useCallback(async () => {
    if (!roomId || !roomName || !userId || !userName) return;
    if (messages.length === 0) {
      setError("Ingen beskeder at opsummere — chatten er tom");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/meetings/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          room_name: roomName,
          user_id: userId,
          user_name: userName,
          messages: messages.map((m) => ({
            sender_name: m.sender_name,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke generere opsummering");
        setGenerating(false);
        return;
      }

      setLatestSummary(data.summary);
      setPastSummaries((prev) => [data.summary, ...prev].slice(0, 5));
      setGenerating(false);
      setShowPanel(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Netværksfejl");
      setGenerating(false);
    }
  }, [roomId, roomName, userId, userName, messages]);

  // Format date
  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("da-DK", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Don't render anything if not in a meeting room
  if (!isInMeetingRoom || !roomId) return null;

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Button in top bar area — placed via parent */}
      <div className="flex items-center gap-2">
        {/* Show latest summary indicator */}
        {latestSummary && !showPanel && (
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ background: COLOURS.surface, border: `1px solid ${COLOURS.border}`, color: COLOURS.text }}
            onClick={() => setShowPanel(true)}
            title="Vis seneste møde-opsummering"
          >
            <span>📋</span>
            <span>{formatDate(latestSummary.created_at)}</span>
          </button>
        )}

        {/* Generate button */}
        <button
          className="px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
          style={{ background: COLOURS.accent, color: "#fff" }}
          onClick={generating ? undefined : handleGenerate}
          disabled={generating || !hasMessages}
          title={
            generating
              ? "Genererer..."
              : !hasMessages
                ? "Ingen beskeder at opsummere"
                : "Generér AI-opsummering af møde-chat"
          }
        >
          {generating ? "⏳ Genererer..." : "📋 Opsummer møde"}
        </button>
      </div>

      {/* Summary panel — overlay panel shown when viewing summaries */}
      {showPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPanel(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden rounded-xl shadow-2xl"
            style={{ background: COLOURS.surface, border: `1px solid ${COLOURS.border}` }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: `1px solid ${COLOURS.border}` }}
            >
              <h2 className="text-sm font-semibold" style={{ color: COLOURS.text }}>
                📋 Møde-opsummering — {roomName || "Mødelokale"}
              </h2>
              <button
                className="px-2 py-0.5 rounded text-xs"
                style={{ background: COLOURS.border, color: COLOURS.textDim }}
                onClick={() => setShowPanel(false)}
              >
                ✕ Luk
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {error && !generating && (
                <div
                  className="mb-3 px-3 py-2 rounded-md text-xs"
                  style={{ background: "rgba(239,83,80,0.1)", color: COLOURS.red, border: `1px solid rgba(239,83,80,0.2)` }}
                >
                  {error}
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div
                    className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{ borderColor: COLOURS.border, borderTopColor: COLOURS.accent }}
                  />
                  <p className="text-xs" style={{ color: COLOURS.textDim }}>
                    Genererer møde-opsummering fra {messageCount} beskeder...
                  </p>
                </div>
              )}

              {!generating && latestSummary && (
                <div>
                  {/* Latest summary */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: COLOURS.accent }}>
                      SENESTE ({formatDate(latestSummary.created_at)})
                    </span>
                    <span className="text-[10px]" style={{ color: COLOURS.textDim }}>
                      {latestSummary.message_count} beskeder — af {latestSummary.requested_by_name}
                    </span>
                  </div>
                  <div
                    className="mb-4 p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ background: COLOURS.bg, color: COLOURS.text, border: `1px solid ${COLOURS.border}` }}
                  >
                    {latestSummary.summary}
                  </div>

                  {/* Past summaries */}
                  {pastSummaries.length > 0 && (
                    <>
                      <button
                        className="flex items-center gap-1 mb-2 text-xs transition-colors"
                        style={{ color: COLOURS.textDim }}
                        onClick={() => setShowPast((p) => !p)}
                      >
                        <span style={{ transform: showPast ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                          ▶
                        </span>
                        Tidligere opsummeringer ({pastSummaries.length})
                      </button>

                      {showPast && (
                        <div className="space-y-3">
                          {pastSummaries.map((s) => (
                            <div key={s.id}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[10px]" style={{ color: COLOURS.textDim }}>
                                  {formatDate(s.created_at)}
                                </span>
                                <span className="text-[10px]" style={{ color: COLOURS.textDim }}>
                                  {s.message_count} beskeder — af {s.requested_by_name}
                                </span>
                              </div>
                              <div
                                className="p-2.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap"
                                style={{ background: COLOURS.bg, color: COLOURS.text, border: `1px solid ${COLOURS.border}`, opacity: 0.8 }}
                              >
                                {s.summary}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!generating && !latestSummary && !error && (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: COLOURS.textDim }}>
                    Ingen opsummeringer endnu.
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLOURS.textDim }}>
                    Chat i mødelokalet og klik på &quot;Opsummer møde&quot; for at generere en AI-opsummering.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {!generating && (
              <div
                className="flex items-center justify-between px-4 py-2 flex-shrink-0"
                style={{ borderTop: `1px solid ${COLOURS.border}` }}
              >
                <span className="text-[10px]" style={{ color: COLOURS.textDim }}>
                  AI-genereret via LLM • resultatet kan indeholde fejl
                </span>
                <button
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ background: COLOURS.accent, color: "#fff" }}
                  onClick={handleGenerate}
                  disabled={generating || !hasMessages}
                >
                  Generér ny
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}