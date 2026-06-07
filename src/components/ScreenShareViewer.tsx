"use client";

// VirtualOffice — screen share viewer
// Renders shared screens as <video> elements. Displays as a draggable
// floating panel overlay on the office canvas.
//
// Single-share UX per meeting room: shows only the first share found
// (the most recently added). Users can collapse/expand the viewer.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenShare } from "@/hooks/useScreenShare";

// ── Colour constants (matching page.tsx / OfficeCanvas) ──────────────────
const COLOURS = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
  red: "#ef5350",
};

export interface ScreenShareViewerProps {
  shares: Map<string, ScreenShare>;
  isSharing: boolean;
  onStopShare: () => void;
}

export default function ScreenShareViewer({
  shares,
  isSharing,
  onStopShare,
}: ScreenShareViewerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 64 }); // top-left offset from bar
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startPosX: 16,
    startPosY: 64,
  });

  // Pick the first share to display (single-share UX)
  const entries = Array.from(shares.entries());
  const activeShare = entries.length > 0 ? entries[0][1] : null;

  // Attach MediaStreamTrack to <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeShare) return;

    // Create a MediaStream containing this single track
    const stream = new MediaStream([activeShare.track]);
    video.srcObject = stream;
    video.play().catch(() => {
      // autoplay may be blocked — user will see play button
    });

    return () => {
      video.srcObject = null;
    };
  }, [activeShare]);

  // ── Dragging ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
      };
    },
    [position],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPosition({
        x: dragRef.current.startPosX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY + (e.clientY - dragRef.current.startY),
      });
    };

    const handleMouseUp = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ── Nothing to show ────────────────────────────────────────────────────

  if (!activeShare) return null;

  // ── Render ─────────────────────────────────────────────────────────────

  const sharerLabel = activeShare.isLocal ? "Du deler skærm" : `${activeShare.name}s skærm`;

  return (
    <div
      className="fixed z-50 rounded-lg shadow-lg overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: collapsed ? 280 : 720,
        background: COLOURS.surface,
        border: `1px solid ${COLOURS.border}`,
        transition: collapsed ? "width 0.2s ease" : "width 0.2s ease",
      }}
    >
      {/* Title bar (draggable handle) */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none"
        style={{
          background: COLOURS.bg,
          borderBottom: `1px solid ${COLOURS.border}`,
        }}
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs font-medium" style={{ color: COLOURS.text }}>
          {sharerLabel}
        </span>
        <div className="flex items-center gap-1">
          {activeShare.isLocal && (
            <button
              className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
              style={{ background: COLOURS.red, color: "#fff" }}
              onClick={(e) => {
                e.stopPropagation();
                onStopShare();
              }}
            >
              Stop
            </button>
          )}
          <button
            className="px-2 py-0.5 rounded text-xs transition-colors"
            style={{ background: COLOURS.border, color: COLOURS.text }}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
          >
            {collapsed ? "Vis" : "Skjul"}
          </button>
        </div>
      </div>

      {/* Video */}
      {!collapsed && (
        <div className="relative" style={{ aspectRatio: "16 / 9", background: "#000" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            muted={activeShare.isLocal} // mute local to avoid echo
          />
        </div>
      )}
    </div>
  );
}