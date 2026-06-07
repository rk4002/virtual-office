"use client";

// VirtualOffice — Chat Bubble Overlay
// Renders floating speech bubbles on the office canvas at the sender's position.
// Bubbles auto-fade and are removed after a TTL.
// Positioned in world coordinates, translated to screen coordinates via the same
// transform OfficeCanvas uses (view offset + zoom).

import { useEffect, useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/lib/db";
import { FLOOR_W, FLOOR_H } from "@/lib/office-layout";

// ── Constants ────────────────────────────────────────────────────────────────

const BUBBLE_TTL_MS = 8_000;       // how long a bubble stays visible
const MAX_BUBBLES = 6;             // max simultaneous bubbles on screen
const FADE_OUT_MS = 2_000;        // fade duration at end of life

// ── Types ────────────────────────────────────────────────────────────────────

export interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

export interface BubbleEntry {
  id: string;
  messageId: string;
  senderName: string;
  text: string;
  worldX: number;
  worldY: number;
  arrivedAt: number; // Date.now()
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChatBubbleOverlayProps {
  messages: ChatMessage[];
  view: ViewState;
  containerWidth: number;
  containerHeight: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatBubbleOverlay({
  messages,
  view,
  containerWidth,
  containerHeight,
}: ChatBubbleOverlayProps) {
  const [bubbles, setBubbles] = useState<BubbleEntry[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // Track new messages → spawn bubbles
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const next = [...bubbles];

    for (const msg of messages) {
      if (seenRef.current.has(msg.id)) continue;
      seenRef.current.add(msg.id);

      // Cap seen set size
      if (seenRef.current.size > 200) {
        const arr = Array.from(seenRef.current);
        seenRef.current = new Set(arr.slice(arr.length - 100));
      }

      next.push({
        id: `bubble-${msg.id}`,
        messageId: msg.id,
        senderName: msg.sender_name,
        text: msg.text,
        worldX: msg.x,
        worldY: msg.y,
        arrivedAt: now,
      });
      changed = true;
    }

    // Keep only the most recent MAX_BUBBLES
    while (next.length > MAX_BUBBLES) {
      next.shift();
    }

    if (changed) {
      setBubbles(next);
    }
  }, [messages]);

  // Prune expired bubbles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setBubbles((prev) =>
        prev.filter((b) => now - b.arrivedAt < BUBBLE_TTL_MS),
      );
    }, 1_000);
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
        const fadeProgress = Math.max(
          0,
          Math.min(1, (BUBBLE_TTL_MS - age) / FADE_OUT_MS),
        );
        if (fadeProgress <= 0) return null;

        const { sx, sy } = toScreen(b.worldX, b.worldY);

        return (
          <div
            key={b.id}
            className="absolute"
            style={{
              left: sx,
              top: sy - 60 * view.zoom, // float above avatar
              opacity: fadeProgress,
              transform: `scale(${Math.min(1, view.zoom * 1.2)})`,
              transformOrigin: "bottom center",
              transition: "opacity 0.3s ease-out",
            }}
          >
            {/* Bubble */}
            <div
              className="rounded-xl px-3 py-1.5 max-w-[200px] shadow-lg pointer-events-auto"
              style={{
                background: "rgba(34, 38, 45, 0.92)",
                border: "1px solid rgba(91, 155, 213, 0.35)",
                backdropFilter: "blur(4px)",
              }}
            >
              <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#5b9bd5" }}>
                {b.senderName}
              </p>
              <p className="text-xs leading-snug break-words" style={{ color: "#d4d6db" }}>
                {b.text.length > 80 ? b.text.slice(0, 77) + "..." : b.text}
              </p>
            </div>

            {/* Arrow / tail pointing down toward avatar */}
            <div className="flex justify-center">
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: "5px solid rgba(34, 38, 45, 0.92)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}