"use client";

// VirtualOffice — Reaction Bubble Overlay
// Renders floating emoji reactions on the office canvas when a user
// reacts to a message. Reactions float upward and fade out over a short
// duration — lightweight, fun, non-blocking.
//
// Sibling to ChatBubbleOverlay — same coordinate transform pattern.

import { useEffect, useState, useCallback, useRef } from "react";
import { FLOOR_W, FLOOR_H } from "@/lib/office-layout";

// ── Constants ────────────────────────────────────────────────────────────────

const BUBBLE_TTL_MS = 4_000;       // how long a reaction bubble stays visible
const MAX_BUBBLES = 8;             // max simultaneous reaction bubbles

// ── Types ────────────────────────────────────────────────────────────────────

export interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

export interface ReactionBubbleEntry {
  id: string;
  messageId: string;
  emoji: string;
  user_name: string;
  worldX: number;
  worldY: number;
  arrivedAt: number; // Date.now()
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ReactionBubbleOverlayProps {
  /** Incoming reaction events (emoji + user + position). Cleared after rendering. */
  reactionEvents: ReactionBubbleEntry[];
  view: ViewState;
  containerWidth: number;
  containerHeight: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReactionBubbleOverlay({
  reactionEvents,
  view,
  containerWidth,
  containerHeight,
}: ReactionBubbleOverlayProps) {
  const [bubbles, setBubbles] = useState<ReactionBubbleEntry[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // Track new reaction events → spawn bubbles
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const next = [...bubbles];

    for (const ev of reactionEvents) {
      // Deduplicate by composite key
      const key = `${ev.messageId}|${ev.emoji}|${ev.user_name}|${ev.arrivedAt}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);

      // Cap seen set size
      if (seenRef.current.size > 300) {
        const arr = Array.from(seenRef.current);
        seenRef.current = new Set(arr.slice(arr.length - 150));
      }

      next.push(ev);
      changed = true;
    }

    // Keep only the most recent MAX_BUBBLES
    while (next.length > MAX_BUBBLES) {
      next.shift();
    }

    if (changed) {
      setBubbles(next);
    }
  }, [reactionEvents]);

  // Prune expired bubbles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setBubbles((prev) =>
        prev.filter((b) => now - b.arrivedAt < BUBBLE_TTL_MS),
      );
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // World → screen coordinate transform (same as OfficeCanvas)
  const toScreen = useCallback(
    (wx: number, wy: number): { sx: number; sy: number } => {
      const ox = -view.x * view.zoom + (containerWidth - FLOOR_W * view.zoom) / 2;
      const oy = -view.y * view.zoom + (containerHeight - FLOOR_H * view.zoom) / 2;
      return {
        sx: ox + wx * view.zoom,
        sy: oy + wy * view.zoom,
      };
    },
    [view, containerWidth, containerHeight],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.map((b) => {
        const now = Date.now();
        const age = now - b.arrivedAt;
        const progress = Math.max(0, Math.min(1, age / BUBBLE_TTL_MS));
        if (progress >= 1) return null;

        const { sx, sy } = toScreen(b.worldX, b.worldY);

        // Float upward and fade out
        const floatY = progress * 60; // pixels upward over lifetime
        const opacity = 1 - progress;
        const scale = 1 + progress * 0.3; // slight grow

        return (
          <div
            key={b.id}
            className="absolute"
            style={{
              left: sx,
              top: sy - 40 * view.zoom - floatY,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              transition: "opacity 0.2s ease-out",
            }}
          >
            <div
              className="rounded-full px-2 py-1 shadow-md flex items-center gap-1"
              style={{
                background: "rgba(34, 38, 45, 0.88)",
                border: "1px solid rgba(91, 155, 213, 0.30)",
                backdropFilter: "blur(3px)",
              }}
            >
              <span className="text-base leading-none">{b.emoji}</span>
              <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: "#d4d6db" }}>
                {b.user_name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}