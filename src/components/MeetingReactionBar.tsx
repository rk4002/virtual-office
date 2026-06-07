"use client";

// VirtualOffice — Meeting Room Quick Reactions
// Floating reaction bar shown in meeting rooms (Whiteboard, ScreenShare).
// Users can send quick emoji reactions that appear as floating bubbles
// on the canvas for all participants to see.

import { useState, useCallback, useRef, useEffect } from "react";
import EmojiPicker from "@/components/EmojiPicker";

// ── Quick reaction emojis ────────────────────────────────────────────────────

const QUICK_REACTIONS = ["👍", "❤️", "😂", "👏", "🔥", "🎉"];

// ── Colours ──────────────────────────────────────────────────────────────────

const COLOURS = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface MeetingReactionBarProps {
  /** Whether the meeting room overlay is visible */
  visible: boolean;
  /** Room name for context */
  roomName: string;
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** Fired when user selects a reaction */
  onReaction: (emoji: string, userId: string, userName: string, timestamp: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MeetingReactionBar({
  visible,
  roomName,
  userId,
  userName,
  onReaction,
}: MeetingReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // ── Handle quick reaction ────────────────────────────────────────────────

  const handleQuickReaction = useCallback(
    (emoji: string) => {
      const now = Date.now();
      onReaction(emoji, userId, userName, now);

      // Track recent (LRU-like — push to front, keep last 4)
      setRecentEmojis((prev) => {
        const filtered = prev.filter((e) => e !== emoji);
        return [emoji, ...filtered].slice(0, 4);
      });
    },
    [userId, userName, onReaction],
  );

  // ── Handle custom emoji from picker ──────────────────────────────────────

  const handleCustomReaction = useCallback(
    (emoji: string) => {
      setPickerOpen(false);
      handleQuickReaction(emoji);
    },
    [handleQuickReaction],
  );

  // ── Combined quick emojis (built-in + recent) ─────────────────────────────

  const displayEmojis = [
    ...QUICK_REACTIONS,
    ...recentEmojis.filter((e) => !QUICK_REACTIONS.includes(e)),
  ].slice(0, 8);

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg"
      style={{
        background: "rgba(34, 38, 45, 0.92)",
        border: "1px solid rgba(91, 155, 213, 0.25)",
        backdropFilter: "blur(6px)",
        transform: "translateX(-50%)",
      }}
    >
      {/* Room label */}
      <span
        className="text-[10px] font-medium mr-1 uppercase tracking-wide"
        style={{ color: COLOURS.textDim }}
      >
        {roomName}
      </span>

      {/* Separator */}
      <div
        className="w-px h-5 mx-0.5"
        style={{ background: COLOURS.border }}
      />

      {/* Quick reaction buttons */}
      {displayEmojis.map((emoji) => (
        <button
          key={emoji}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all hover:scale-125 hover:bg-opacity-20"
          style={{
            background: "transparent",
          }}
          onClick={() => handleQuickReaction(emoji)}
          title={emoji}
        >
          {emoji}
        </button>
      ))}

      {/* Separator */}
      <div
        className="w-px h-5 mx-0.5"
        style={{ background: COLOURS.border }}
      />

      {/* More / custom emoji button */}
      <div className="relative">
        <button
          ref={moreButtonRef}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all hover:bg-opacity-20"
          style={{
            background: pickerOpen ? "rgba(91, 155, 213, 0.2)" : "transparent",
            color: pickerOpen ? COLOURS.accent : COLOURS.textDim,
          }}
          onClick={() => setPickerOpen((prev) => !prev)}
          title="Flere emojis"
        >
          +
        </button>
        <EmojiPicker
          open={pickerOpen}
          onSelect={handleCustomReaction}
          onClose={() => setPickerOpen(false)}
          anchorRef={moreButtonRef as React.RefObject<HTMLElement | null>}
        />
      </div>
    </div>
  );
}

export { QUICK_REACTIONS };