"use client";

// VirtualOffice — Chat Panel
// Sidebar panel with chat messages, input field, room/DM scope selector,
// and emoji reactions. Drives from the /api/chat SSE stream via useChat hook.

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, ChatScope, AggregatedReaction } from "@/lib/db";
import { useChat, useChatUnread } from "@/hooks/useChat";
import { ROOMS, roomForPoint, type Room } from "@/lib/office-layout";
import type { PresenceUser } from "@/hooks/usePresence";
import EmojiPicker from "@/components/EmojiPicker";

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

export interface ChatPanelProps {
  currentUserId: string;
  currentUserName: string;
  playerX: number;
  playerY: number;
  presenceUsers: PresenceUser[];
  /** Aggregated reactions per message_id */
  reactions: Map<string, AggregatedReaction[]>;
  /** Toggle a reaction on a message */
  onToggleReaction: (params: {
    message_id: string;
    emoji: string;
    user_id: string;
    user_name: string;
  }) => Promise<{ action: "added" | "removed"; reactions: AggregatedReaction[] }>;
  /** Check if the current user has reacted with a specific emoji */
  onHasReacted: (message_id: string, emoji: string, user_id: string) => boolean;
  /** Fired when a reaction is toggled — used to spawn floating reaction bubbles on the canvas */
  onReactionEvent?: (ev: { messageId: string; emoji: string; user_name: string; worldX: number; worldY: number; action: "added" | "removed" }) => void;
  onNewMessage?: (msg: ChatMessage) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ChatPanel({
  currentUserId,
  currentUserName,
  playerX,
  playerY,
  presenceUsers,
  reactions,
  onToggleReaction,
  onHasReacted,
  onReactionEvent,
  onNewMessage,
}: ChatPanelProps) {
  // Chat scope state
  const [scope, setScope] = useState<ChatScope>("room");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [dmRecipientId, setDmRecipientId] = useState<string | null>(null);
  const [dmRecipientName, setDmRecipientName] = useState<string | null>(null);

  // Determine current room from player position
  const currentRoom = roomForPoint(playerX, playerY);

  // Effective room ID for chat filtering
  const effectiveRoomId = selectedRoomId ?? currentRoom?.id ?? null;

  // Chat hook
  const { messages, send } = useChat(
    scope === "room"
      ? { roomId: effectiveRoomId ?? undefined }
      : dmRecipientId
        ? { dmWith: dmRecipientId }
        : {},
  );

  const { unread, markRead, trackMessage } = useChatUnread(currentUserId);

  // Track new messages
  useEffect(() => {
    for (const msg of messages) {
      trackMessage(msg, scope === "room" ? effectiveRoomId : dmRecipientId);
      onNewMessage?.(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Mark active scope as read
  useEffect(() => {
    markRead(scope === "room" ? (effectiveRoomId || "__global__") : `__dm__${dmRecipientId || ""}`);
  }, [scope, effectiveRoomId, dmRecipientId, markRead]);

  // Input state
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !currentUserId) return;

    try {
      await send({
        scope,
        recipientId: dmRecipientId ?? undefined,
        text,
        senderId: currentUserId,
        senderName: currentUserName || "Gæst",
        x: playerX,
        y: playerY,
      });
      setInput("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Chat send error:", err);
    }
  }, [input, currentUserId, currentUserName, playerX, playerY, scope, dmRecipientId, send]);

  // Handle Enter to send
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Room selector ───────────────────────────────────────────────────────

  const rooms = ROOMS;
  const selectedRoom = rooms.find((r) => r.id === effectiveRoomId);

  // ── Time formatting ─────────────────────────────────────────────────────

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "lige nu";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min siden`;
    return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  }

  // ── Avatar colour ───────────────────────────────────────────────────────

  const AVATAR_COLOURS = [
    "#5b9bd5", "#4caf50", "#ffa726", "#ef5350",
    "#ab47bc", "#26c6da", "#ec407a", "#7e57c2",
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

  // ── Render ──────────────────────────────────────────────────────────────

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
          Chat
        </h2>
      </div>

      {/* Scope tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${COLOURS.border}` }}>
        <button
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={{
            background: scope === "room" ? COLOURS.bg : "transparent",
            color: scope === "room" ? COLOURS.accent : COLOURS.textDim,
            borderBottom: scope === "room" ? `2px solid ${COLOURS.accent}` : "2px solid transparent",
          }}
          onClick={() => setScope("room")}
        >
          Rum
        </button>
        <button
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={{
            background: scope === "private" ? COLOURS.bg : "transparent",
            color: scope === "private" ? COLOURS.accent : COLOURS.textDim,
            borderBottom: scope === "private" ? `2px solid ${COLOURS.accent}` : "2px solid transparent",
          }}
          onClick={() => setScope("private")}
        >
          Privat
        </button>
      </div>

      {/* Room selector (only for room scope) */}
      {scope === "room" && (
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${COLOURS.border}` }}>
          <select
            className="w-full px-2 py-1.5 rounded text-xs outline-none"
            style={{
              background: COLOURS.bg,
              border: `1px solid ${COLOURS.border}`,
              color: COLOURS.text,
            }}
            value={selectedRoomId ?? ""}
            onChange={(e) => setSelectedRoomId(e.target.value || null)}
          >
            <option value="">{currentRoom ? `${currentRoom.name} (auto)` : "Hele kontoret"}</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}{room.id === currentRoom?.id ? " ← du er her" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* DM recipient selector (only for private scope) */}
      {scope === "private" && (
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${COLOURS.border}` }}>
          {dmRecipientId ? (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: avatarColor(dmRecipientId) }}
              >
                <span className="text-[10px] font-bold text-white">{initials(dmRecipientName || "?")}</span>
              </div>
              <span className="text-xs flex-1 truncate" style={{ color: COLOURS.text }}>
                {dmRecipientName || "Ukendt"}
              </span>
              <button
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: COLOURS.border, color: COLOURS.textDim }}
                onClick={() => { setDmRecipientId(null); setDmRecipientName(null); }}
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              className="w-full px-2 py-1.5 rounded text-xs outline-none"
              style={{
                background: COLOURS.bg,
                border: `1px solid ${COLOURS.border}`,
                color: COLOURS.text,
              }}
              value=""
              onChange={(e) => {
                const uid = e.target.value;
                const user = presenceUsers.find((u) => u.user_id === uid);
                setDmRecipientId(uid);
                setDmRecipientName(user?.name ?? uid);
              }}
            >
              <option value="">Vælg modtager...</option>
              {presenceUsers
                .filter((u) => u.user_id !== currentUserId)
                .map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      {/* Room info banner */}
      {scope === "room" && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${COLOURS.border}` }}>
          <span className="text-xs" style={{ color: COLOURS.textDim }}>
            {selectedRoom
              ? `Viser beskeder i ${selectedRoom.name}`
              : currentRoom
                ? `Viser beskeder i ${currentRoom.name} (du er her)`
                : "Viser alle rum-beskeder"}
          </span>
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: COLOURS.textDim }}>
              Ingen beskeder endnu
            </p>
            <p className="text-xs mt-1" style={{ color: COLOURS.textDim }}>
              Skriv noget for at starte samtalen!
            </p>
          </div>
        )}
        {messages.map((msg) => {
            const msgReactions = reactions.get(msg.id) || [];
            return (
              <ChatBubbleItem
                key={msg.id}
                msg={msg}
                isSelf={msg.sender_id === currentUserId}
                avatarColor={avatarColor(msg.sender_id)}
                initials={initials(msg.sender_name)}
                formatTime={formatTime}
                reactions={reactions}
                onToggleReaction={onToggleReaction}
                onHasReacted={onHasReacted}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                onReactionEvent={onReactionEvent}
                playerX={playerX}
                playerY={playerY}
                msgReactions={msgReactions}
              />
            );
          })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${COLOURS.border}` }}
      >
        <input
          ref={inputRef}
          className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
          style={{
            background: COLOURS.bg,
            border: `1px solid ${COLOURS.border}`,
            color: COLOURS.text,
          }}
          placeholder={
            scope === "room"
              ? `Skriv i ${selectedRoom?.name || currentRoom?.name || "chat"}...`
              : dmRecipientId
                ? `Skriv til ${dmRecipientName}...`
                : "Vælg en modtager..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          disabled={scope === "private" && !dmRecipientId}
        />
        <button
          className="px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
          style={{ background: COLOURS.accent, color: "#fff" }}
          onClick={handleSend}
          disabled={!input.trim() || (scope === "private" && !dmRecipientId)}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ChatBubbleItem sub-component — with emoji reactions
//

function ChatBubbleItem({
  msg,
  isSelf,
  avatarColor,
  initials,
  formatTime,
  reactions,
  onToggleReaction,
  onHasReacted,
  currentUserId,
  currentUserName,
  onReactionEvent,
  playerX,
  playerY,
  msgReactions,
}: {
  msg: ChatMessage;
  isSelf: boolean;
  avatarColor: string;
  initials: string;
  formatTime: (iso: string) => string;
  reactions: Map<string, AggregatedReaction[]>;
  onToggleReaction: (params: {
    message_id: string;
    emoji: string;
    user_id: string;
    user_name: string;
  }) => Promise<{ action: "added" | "removed"; reactions: AggregatedReaction[] }>;
  onHasReacted: (message_id: string, emoji: string, user_id: string) => boolean;
  currentUserId: string;
  currentUserName: string;
  onReactionEvent?: (ev: { messageId: string; emoji: string; user_name: string; worldX: number; worldY: number; action: "added" | "removed" }) => void;
  playerX: number;
  playerY: number;
  msgReactions: AggregatedReaction[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchorRef = useRef<HTMLButtonElement>(null);

  const handleReactionSelect = useCallback(
    async (emoji: string) => {
      setPickerOpen(false);
      try {
        const result = await onToggleReaction({
          message_id: msg.id,
          emoji,
          user_id: currentUserId,
          user_name: currentUserName,
        });
        onReactionEvent?.({
          messageId: msg.id,
          emoji,
          user_name: currentUserName,
          worldX: playerX,
          worldY: playerY,
          action: result.action,
        });
      } catch (err) {
        console.error("Reaction toggle error:", err);
      }
    },
    [msg.id, currentUserId, currentUserName, playerX, playerY, onToggleReaction, onReactionEvent],
  );

  return (
    <div className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""} group`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: avatarColor }}
      >
        <span className="text-[10px] font-bold text-white">{initials}</span>
      </div>

      {/* Bubble */}
      <div className={`flex flex-col ${isSelf ? "items-end" : "items-start"} flex-1 min-w-0`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-medium" style={{ color: isSelf ? COLOURS.accent : COLOURS.green }}>
            {msg.sender_name}
          </span>
          {msg.scope === "private" && (
            <span className="text-[10px] px-1 py-px rounded" style={{ background: COLOURS.border, color: COLOURS.textDim }}>
              DM
            </span>
          )}
        </div>
        <div
          className="px-3 py-1.5 rounded-2xl max-w-[85%] text-sm"
          style={{
            background: isSelf ? COLOURS.accent : COLOURS.border,
            color: "#fff",
            borderRadius: isSelf ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          }}
        >
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        </div>

        {/* Reaction badges + emoji picker trigger */}
        <div className="flex items-center gap-1 mt-0.5">
          {msgReactions.map((agg) => (
            <button
              key={agg.emoji}
              className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              style={{
                background: onHasReacted(msg.id, agg.emoji, currentUserId)
                  ? "rgba(91, 155, 213, 0.3)"
                  : "rgba(46, 51, 59, 0.6)",
                border: onHasReacted(msg.id, agg.emoji, currentUserId)
                  ? "1px solid rgba(91, 155, 213, 0.5)"
                  : "1px solid rgba(46, 51, 59, 0.4)",
                color: "#d4d6db",
              }}
              onClick={async () => {
                try {
                  const result = await onToggleReaction({
                    message_id: msg.id,
                    emoji: agg.emoji,
                    user_id: currentUserId,
                    user_name: currentUserName,
                  });
                  onReactionEvent?.({
                    messageId: msg.id,
                    emoji: agg.emoji,
                    user_name: currentUserName,
                    worldX: playerX,
                    worldY: playerY,
                    action: result.action,
                  });
                } catch (err) {
                  console.error("Reaction toggle error:", err);
                }
              }}
              title={`${agg.users.length}: ${agg.emoji}`}
            >
              <span>{agg.emoji}</span>
              {agg.count > 1 && <span className="text-[10px]">{agg.count}</span>}
            </button>
          ))}

          {/* Emoji picker trigger — visible on hover */}
          <div className="relative">
            <button
              ref={pickerAnchorRef}
              className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{
                background: "rgba(46, 51, 59, 0.5)",
                border: "1px solid rgba(46, 51, 59, 0.4)",
                color: COLOURS.textDim,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((prev) => !prev);
              }}
              title="Tilføj reaktion"
            >
              +
            </button>
            <EmojiPicker
              open={pickerOpen}
              onSelect={handleReactionSelect}
              onClose={() => setPickerOpen(false)}
              anchorRef={pickerAnchorRef as React.RefObject<HTMLElement | null>}
              activeEmojis={msgReactions.filter((a) => a.users.includes(currentUserId)).map((a) => a.emoji)}
            />
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-[10px] mt-0.5 px-1" style={{ color: COLOURS.textDim }}>
          {formatTime(msg.created_at)}
        </span>
      </div>
    </div>
  );
}