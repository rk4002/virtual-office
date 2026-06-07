"use client";

// VirtualOffice — main office page
// Wires useLiveKitRoom hook (spatial audio + LiveKit) to the OfficeCanvas renderer.
// Chat: independent text-chat via SSE + Vercel Postgres (works alongside or without LiveKit).
//
// Performance: LiveKit (~400KB + 172KB components) and the canvas renderer are
// lazy-loaded via next/dynamic — they only load after the user clicks "Gå til kontoret",
// cutting the initial page JS from 134KB to ~50KB.

import { useCallback, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import ChatBubbleOverlay from "@/components/ChatBubbleOverlay";
import type { ViewState } from "@/components/ChatBubbleOverlay";
import TeamsMeetingButton from "@/components/TeamsMeetingButton";
import Whiteboard from "@/components/Whiteboard";
import CoffeeMachine from "@/components/CoffeeMachine";
import MeetingSummaryPanel from "@/components/MeetingSummaryPanel";
import MeetingReactionBar from "@/components/MeetingReactionBar";
import { useChat } from "@/hooks/useChat";
import { useReactions } from "@/hooks/useReactions";
import ReactionBubbleOverlay from "@/components/ReactionBubbleOverlay";
import type { ReactionBubbleEntry } from "@/components/ReactionBubbleOverlay";
import { roomForPoint } from "@/lib/office-layout";
import { usePresence, useHeartbeat, deriveUserId } from "@/hooks/usePresence";
import { useTeamsMeetings, useCreateMeeting, useAllMeetingStatuses } from "@/hooks/useTeamsMeetings";

// Lazy-loaded heavy chunks (only loaded after joining — not in initial bundle)
const LazyOfficeCanvas = dynamic(() => import("@/components/OfficeCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center flex-1"
      style={{ background: "#1a1d23" }}
    >
      <p className="text-sm" style={{ color: "#888c94" }}>
        Indlæser kontor...
      </p>
    </div>
  ),
});

const LazyChatPanel = dynamic(() => import("@/components/ChatPanel"), {
  ssr: false,
});
const LazyPresencePanel = dynamic(() => import("@/components/PresencePanel"), {
  ssr: false,
});

import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { useScreenShare } from "@/hooks/useScreenShare";
import ScreenShareViewer from "@/components/ScreenShareViewer";

// Import ConnectionStatus eagerly — it's just a type
import type { ConnectionStatus } from "@/hooks/useLiveKitRoom";

// ── Colour constants (matching OfficeCanvas) ────────────────────────────────
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

function statusColor(s: ConnectionStatus): string {
  switch (s) {
    case "connected":
      return COLOURS.green;
    case "connecting":
      return COLOURS.amber;
    default:
      return COLOURS.red;
  }
}

function statusLabel(s: ConnectionStatus): string {
  switch (s) {
    case "connected":
      return "Forbundet";
    case "connecting":
      return "Forbinder...";
    case "error":
      return "Fejl";
    default:
      return "Afbrudt";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const [roomName, setRoomName] = useState("virtual-office");
  const [participantName, setParticipantName] = useState("");

  const liveKit = useLiveKitRoom();
  // Always call hooks unconditionally — returns disconnected state when not connected
  const status: ConnectionStatus = liveKit?.status ?? "disconnected";
  const error = liveKit?.error ?? null;
  const connect = liveKit?.connect;
  const disconnect = liveKit?.disconnect;
  const micEnabled = liveKit?.micEnabled ?? false;
  const toggleMic = liveKit?.toggleMic;
  const peers = liveKit?.peers ?? new Map();
  const player = liveKit?.player ?? { id: "", name: "", x: 0, y: 0, targetX: 0, targetY: 0 };
  const liveKitSetPlayerTarget = liveKit?.setPlayerTarget;
  const roomRef = liveKit?.roomRef ?? { current: null };
  // Screen sharing (needs roomRef — available after connect)
  const screenShare = useScreenShare(
    roomRef as React.RefObject<import("livekit-client").Room | null>,
    participantName || "gæst",
  );
  // Fallback no-op while LiveKit module loads — avoids type error on OfficeCanvas
  const setPlayerTarget = useCallback(
    (x: number, y: number) => {
      liveKitSetPlayerTarget?.(x, y);
    },
    [liveKitSetPlayerTarget],
  );
  

  // ── Presence (SSE — independent of LiveKit) ──────────────────────────────
  const participantNameForPresence = participantName || "Gæst";
  const userId = deriveUserId(participantNameForPresence);
  const presenceUsers = usePresence();
  useHeartbeat(
    userId,
    participantNameForPresence,
    `${participantNameForPresence.toLowerCase().replace(/\s+/g, ".")}@virtual-office.local`,
    player.x,
    player.y,
  );
  const [showJoin, setShowJoin] = useState(true);

  // ── Whiteboard ────────────────────────────────────────────────────────
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // ── Chat (SSE — independent of LiveKit + audio) ──────────────────────────
  const currentRoom = roomForPoint(player.x, player.y);
  const roomId = currentRoom?.id ?? undefined;
  const { messages: chatMessages } = useChat({ roomId });

  // ── Reactions ──────────────────────────────────────────────────────────
  const messageIds = chatMessages.map((m) => m.id);
  const { reactions, toggle: toggleReaction, hasReacted } = useReactions(userId, messageIds);
  const [reactionEvents, setReactionEvents] = useState<ReactionBubbleEntry[]>([]);

  // ── Teams meetings (Graph API — independent of LiveKit) ──────────────────
  const { meetings, loading: meetingsLoading } = useTeamsMeetings(10_000);
  const { createMeeting, creating: meetingCreating } = useCreateMeeting();
  const { statuses: meetingStatuses } = useAllMeetingStatuses(10_000);

  const handleCreateMeeting = useCallback(
    (meetingRoomId: string) => {
      createMeeting({
        subject: `VirtualOffice møde — ${meetingRoomId}`,
        roomId: meetingRoomId,
      });
    },
    [createMeeting],
  );

  const handleJoinMeeting = useCallback((joinUrl: string) => {
    window.open(joinUrl, "_blank", "noopener,noreferrer");
  }, []);

  // Canvas container ref + view state for ChatBubbleOverlay
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, zoom: 0.6 });

  // Track canvas container size
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track view state from OfficeCanvas via a callback
  const handleViewChange = useCallback((vs: ViewState) => {
    setViewState(vs);
  }, []);

  // ── Reaction handlers ──────────────────────────────────────────────────
  const handleReactionEvent = useCallback(
    (ev: { messageId: string; emoji: string; user_name: string; worldX: number; worldY: number; action: "added" | "removed" }) => {
      if (ev.action !== "added") return; // only spawn bubbles on add
      const entry: ReactionBubbleEntry = {
        id: `rb-${ev.messageId}-${ev.emoji}-${Date.now()}`,
        messageId: ev.messageId,
        emoji: ev.emoji,
        user_name: ev.user_name,
        worldX: ev.worldX,
        worldY: ev.worldY,
        arrivedAt: Date.now(),
      };
      setReactionEvents((prev) => [...prev, entry].slice(-8));
    },
    [],
  );

  // ── Meeting room reaction handler ───────────────────────────────────────
  const handleMeetingReaction = useCallback(
    (emoji: string, uid: string, uname: string, timestamp: number) => {
      const entry: ReactionBubbleEntry = {
        id: `mr-${uid}-${emoji}-${timestamp}`,
        messageId: "", // meeting reactions don't have a message context
        emoji,
        user_name: uname,
        worldX: player.x,
        worldY: player.y,
        arrivedAt: timestamp,
      };
      setReactionEvents((prev) => [...prev, entry].slice(-8));
    },
    [player.x, player.y],
  );

  // ── Callbacks ────────────────────────────────────────────────────────────

  const handleJoin = useCallback(async () => {
    const name = participantName.trim() || `Gæst-${Math.floor(Math.random() * 1000)}`;
    setParticipantName(name);
    setShowJoin(false);
    if (!connect) return;
    await connect(roomName.trim() || "virtual-office", name);
  }, [connect, participantName, roomName]);

  const handleDisconnect = useCallback(async () => {
    if (disconnect) await disconnect();
    setShowJoin(true);
  }, [disconnect]);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Join screen
  if (showJoin && status !== "connected") {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-6"
        style={{ background: COLOURS.bg, color: COLOURS.text }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">VirtualOffice</h1>
          <p className="text-sm" style={{ color: COLOURS.textDim }}>
            Dit 2D virtuelle kontor med spatial audio
          </p>
        </div>

        <div className="flex flex-col gap-3 w-80" style={{ background: COLOURS.surface, padding: "20px", borderRadius: "12px", border: `1px solid ${COLOURS.border}` }}>
          <input
            className="px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              background: COLOURS.bg,
              border: `1px solid ${COLOURS.border}`,
              color: COLOURS.text,
            }}
            placeholder="Dit navn"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
          />
          <input
            className="px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              background: COLOURS.bg,
              border: `1px solid ${COLOURS.border}`,
              color: COLOURS.text,
            }}
            placeholder="Kontornavn (fx virtual-office)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: COLOURS.accent,
              color: "#fff",
            }}
            onClick={handleJoin}
            disabled={status === "connecting"}
          >
            {status === "connecting" ? "Forbinder..." : "Gå til kontoret"}
          </button>
          {error && (
            <p className="text-xs" style={{ color: COLOURS.red }}>
              {error}
            </p>
          )}
        </div>

        <p className="text-xs" style={{ color: COLOURS.textDim }}>
          Kræver LiveKit Cloud (LIVEKIT_API_KEY + LIVEKIT_API_SECRET i .env.local)
        </p>
      </div>
    );
  }

  const presenceOthersCount = presenceUsers.filter((u) => u.user_id !== userId).length;

  // Office view
  return (
    <div className="flex flex-col h-screen" style={{ background: COLOURS.bg }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0 z-10"
        style={{
          background: COLOURS.surface,
          borderBottom: `1px solid ${COLOURS.border}`,
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: COLOURS.text }}>
            VirtualOffice
          </h1>
          {/* Live presence count */}
          <span className="flex items-center gap-1.5 text-xs" style={{ color: COLOURS.textDim }}>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: COLOURS.green }}
            />
            {presenceOthersCount} online
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Status */}
          <span className="flex items-center gap-1.5 text-xs" style={{ color: COLOURS.textDim }}>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: statusColor(status) }}
            />
            {statusLabel(status)}
          </span>

          {/* Mic toggle */}
          <button
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: micEnabled ? COLOURS.green : COLOURS.red,
              color: "#fff",
            }}
            onClick={toggleMic}
            disabled={status !== "connected"}
          >
            {micEnabled ? "🎙️ Mute" : "🔇 Unmute"}
          </button>

          {/* Screen share toggle */}
          <button
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: screenShare.isSharing ? COLOURS.red : COLOURS.accent,
              color: "#fff",
            }}
            onClick={() =>
              screenShare.isSharing
                ? screenShare.stopShare()
                : screenShare.startShare()
            }
            disabled={status !== "connected"}
          >
            {screenShare.isSharing ? "⏹ Stop deling" : "🖥️ Del skærm"}
          </button>

          {/* Whiteboard button — only visible when in a meeting room */}
          {currentRoom?.type === "meeting" && (
            <button
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: showWhiteboard ? COLOURS.amber : COLOURS.accent,
                color: "#fff",
              }}
              onClick={() => setShowWhiteboard((prev) => !prev)}
              title="Åbn whiteboard til brainstorming"
            >
              {showWhiteboard ? "🎨 Luk whiteboard" : "🎨 Whiteboard"}
            </button>
          )}

          {/* Teams button */}
          <TeamsMeetingButton
            currentRoomId={roomId}
            meetings={meetings}
            onCreateMeeting={handleCreateMeeting}
            onJoinMeeting={handleJoinMeeting}
            creating={meetingCreating}
          />

          {/* Meeting summary — AI-generated meeting summary from room chat */}
          <MeetingSummaryPanel
            roomId={roomId ?? null}
            roomName={currentRoom?.name ?? null}
            isInMeetingRoom={currentRoom?.type === "meeting"}
            messages={chatMessages}
            userId={userId}
            userName={participantNameForPresence}
          />

          {/* Disconnect */}
          <button
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: COLOURS.border,
              color: COLOURS.text,
            }}
            onClick={handleDisconnect}
          >
            Afbryd
          </button>
        </div>
      </div>

      {/* Main area: canvas + chat panel + presence sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={canvasContainerRef} className="flex-1 relative">
          <LazyOfficeCanvas
            player={player}
            peers={peers}
            presenceUsers={presenceUsers}
            chatMessages={chatMessages}
            meetingStatuses={meetingStatuses}
            status={status}
            error={error}
            onMoveClick={setPlayerTarget}
            onViewChange={handleViewChange}
          />
          <ChatBubbleOverlay
            messages={chatMessages}
            view={viewState}
            containerWidth={canvasSize.width}
            containerHeight={canvasSize.height}
          />
          <ReactionBubbleOverlay
            reactionEvents={reactionEvents}
            view={viewState}
            containerWidth={canvasSize.width}
            containerHeight={canvasSize.height}
          />
          <ScreenShareViewer
            shares={screenShare.shares}
            isSharing={screenShare.isSharing}
            onStopShare={screenShare.stopShare}
          />
        </div>
        <div className="w-72 flex-shrink-0 border-l" style={{ borderColor: COLOURS.border }}>
          <LazyChatPanel
            currentUserId={userId}
            currentUserName={participantNameForPresence}
            playerX={player.x}
            playerY={player.y}
            presenceUsers={presenceUsers}
            reactions={reactions}
            onToggleReaction={toggleReaction}
            onHasReacted={hasReacted}
            onReactionEvent={handleReactionEvent}
          />
        </div>
        <div className="w-56 flex-shrink-0 border-l" style={{ borderColor: COLOURS.border }}>
          <LazyPresencePanel users={presenceUsers} meetingStatuses={meetingStatuses} currentUserId={userId} />
        </div>
      </div>

      {/* Whiteboard overlay — triggered by the Whiteboard button in the top bar */}
      <Whiteboard
        roomName={currentRoom?.name ?? "Whiteboard"}
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
      />

      {/* Meeting room quick reactions — shown when in a meeting room with WB or screen share */}
      <MeetingReactionBar
        visible={currentRoom?.type === "meeting" && (showWhiteboard || screenShare.isSharing)}
        roomName={currentRoom?.name ?? "Mødelokale"}
        userId={userId}
        userName={participantNameForPresence}
        onReaction={handleMeetingReaction}
      />

      {/* Virtual coffee machine — daily random match with online colleagues */}
      <CoffeeMachine userId={userId} userName={participantNameForPresence} />
    </div>
  );
}