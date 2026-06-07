"use client";

// VirtualOffice — Emoji Reaction Picker
// Compact popover with searchable emoji grid + custom emoji text input.
// Used in ChatPanel and ChatBubbleOverlay.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ── Common reaction emojis ──────────────────────────────────────────────────

const COMMON_EMOJIS = [
  "👍", "❤️", "😂", "😮", "😢", "😡",
  "👏", "🎉", "🔥", "💯", "🤔", "👀",
  "🙌", "😍", "🤩", "🥳", "😎", "🤯",
  "😤", "👋", "✨", "💪", "🙏", "💀",
];

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

export interface EmojiPickerProps {
  /** Whether the picker is visible */
  open: boolean;
  /** Called when user selects an emoji */
  onSelect: (emoji: string) => void;
  /** Called when the picker should close (click outside, etc.) */
  onClose: () => void;
  /** Position anchor — renders near this element or position */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Currently reacted emojis (to highlight if already selected) */
  activeEmojis?: string[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EmojiPicker({
  open,
  onSelect,
  onClose,
  anchorRef,
  activeEmojis = [],
}: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");

  // ── Filter emojis by search ──────────────────────────────────────────────

  const filteredEmojis = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return COMMON_EMOJIS;

    // Simple keyword → emoji heuristic mapping
    const KEYWORD_MAP: Record<string, string[]> = {
      "like": ["👍"],
      "love": ["❤️", "😍", "🥰"],
      "heart": ["❤️", "😍"],
      "laugh": ["😂", "🤣"],
      "haha": ["😂"],
      "wow": ["😮", "🤯"],
      "surprise": ["😮", "🤯"],
      "sad": ["😢", "😭"],
      "cry": ["😢", "😭"],
      "angry": ["😡", "😤"],
      "mad": ["😡", "😤"],
      "clap": ["👏"],
      "party": ["🎉", "🥳"],
      "fire": ["🔥"],
      "perfect": ["💯"],
      "think": ["🤔"],
      "eyes": ["👀"],
      "raise": ["🙌"],
      "wave": ["👋"],
      "sparkle": ["✨"],
      "strong": ["💪"],
      "pray": ["🙏"],
      "skull": ["💀"],
      "cool": ["😎"],
      "star": ["⭐", "✨"],
      "ok": ["👌", "👍"],
      "yes": ["👍", "✅"],
      "no": ["👎", "❌"],
      "thank": ["🙏"],
      "congrats": ["🎉", "👏"],
      "nice": ["👍", "🔥"],
      "lol": ["😂"],
      "mind": ["🤯"],
    };

    // Try keyword match
    const keywordMatches = KEYWORD_MAP[q] || [];

    // Also try substring match on emoji descriptions
    const substringMatches = COMMON_EMOJIS.filter((e) => {
      // Unicode emojis don't have searchable text, so rely on keyword mapping
      return keywordMatches.includes(e);
    });

    // Deduplicate and return
    const results = [...new Set([...keywordMatches, ...substringMatches])];
    return results.length > 0 ? results : COMMON_EMOJIS.slice(0, 6);
  }, [search]);

  // ── Close on outside click ───────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose, anchorRef]);

  // ── Close on Escape ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // ── Focus search input on open ───────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setSearch("");
      setCustomInput("");
      // Small delay so the DOM is mounted
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [open]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Accept any single emoji or emoji sequence
    // Basic check: ensure it contains at least one emoji-like character
    // (non-ASCII, non-alphanumeric, non-whitespace)
    const hasEmoji = /[\p{Emoji}\u{200D}\u{FE0F}]/u.test(trimmed);
    if (!hasEmoji) return;

    onSelect(trimmed.slice(0, 12)); // cap at 12 chars to prevent abuse
    setCustomInput("");
  }, [customInput, onSelect]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && filteredEmojis.length > 0) {
        handleSelect(filteredEmojis[0]);
      }
    },
    [filteredEmojis, handleSelect],
  );

  const handleCustomKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCustomSubmit();
      }
    },
    [handleCustomSubmit],
  );

  if (!open) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 rounded-lg shadow-xl p-2"
      style={{
        background: COLOURS.surface,
        border: `1px solid ${COLOURS.border}`,
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: "4px",
        minWidth: "200px",
      }}
    >
      {/* ── Search input ────────────────────────────────────────────────── */}
      <div className="mb-2">
        <input
          ref={searchInputRef}
          type="text"
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{
            background: COLOURS.bg,
            border: `1px solid ${COLOURS.border}`,
            color: COLOURS.text,
          }}
          placeholder="Søg emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      {/* ── Emoji grid ──────────────────────────────────────────────────── */}
      {filteredEmojis.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {filteredEmojis.map((emoji) => {
            const isActive = activeEmojis.includes(emoji);
            return (
              <button
                key={emoji}
                className="w-8 h-8 flex items-center justify-center rounded-md text-lg transition-all hover:scale-125"
                style={{
                  background: isActive ? "rgba(91, 155, 213, 0.3)" : "transparent",
                  border: isActive ? `1px solid ${COLOURS.accent}` : "1px solid transparent",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(emoji);
                }}
                title={emoji}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-center mb-2" style={{ color: COLOURS.textDim }}>
          Ingen match — brug input nedenfor
        </p>
      )}

      {/* ── Custom emoji input ──────────────────────────────────────────── */}
      <div className="flex gap-1">
        <input
          type="text"
          className="flex-1 px-2 py-1 rounded text-xs outline-none"
          style={{
            background: COLOURS.bg,
            border: `1px solid ${COLOURS.border}`,
            color: COLOURS.text,
          }}
          placeholder="Skriv/paste emoji..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          maxLength={30}
        />
        <button
          className="px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{
            background: customInput.trim() ? COLOURS.accent : COLOURS.border,
            color: customInput.trim() ? "#fff" : COLOURS.textDim,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleCustomSubmit();
          }}
          disabled={!customInput.trim()}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export { COMMON_EMOJIS };