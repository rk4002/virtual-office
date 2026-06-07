"use client";

// VirtualOffice — 2D office canvas renderer
// Renders the floor plan with rooms, peer avatars, and the local player.
// Movement: click-to-move + WASD/arrow keys.
// Spatial audio is handled by useLiveKitRoom — this component is purely visual.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FLOOR_W,
  FLOOR_H,
  SPAWN,
  PLAYER_COLOR,
  ROOMS,
  Room,
  RoomType,
} from "@/lib/office-layout";
import type { LiveKitPeer, PlayerState } from "@/hooks/useLiveKitRoom";
import type { PresenceUser } from "@/hooks/usePresence";
import type { ChatMessage, MeetingStatus } from "@/lib/db";
import type { ViewState } from "@/components/ChatBubbleOverlay";

// ── Colour and theme constants (ported from prototype) ──────────────────────
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
  roomBg: "rgba(30,35,44,0.6)",
  roomMeeting: "rgba(91,155,213,0.08)",
  roomFocus: "rgba(239,83,80,0.08)",
  roomSocial: "rgba(76,175,80,0.08)",
  zoneWarm: "rgba(255,167,38,0.04)",
  zoneCool: "rgba(91,155,213,0.04)",
  zoneSage: "rgba(76,175,80,0.04)",
};

function roomFill(type: RoomType): string {
  switch (type) {
    case "meeting":
      return COLOURS.roomMeeting;
    case "focus":
      return COLOURS.roomFocus;
    case "social":
      return COLOURS.roomSocial;
    default:
      return COLOURS.roomBg;
  }
}

function roomBorder(type: RoomType): string {
  switch (type) {
    case "meeting":
      return "rgba(91,155,213,0.25)";
    case "focus":
      return "rgba(239,83,80,0.25)";
    case "social":
      return "rgba(76,175,80,0.25)";
    default:
      return "rgba(46,51,59,0.5)";
  }
}

function roomLabel(type: RoomType): string {
  switch (type) {
    case "meeting":
      return "Meeting";
    case "focus":
      return "Focus";
    case "social":
      return "Social";
    default:
      return "";
  }
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface OfficeCanvasProps {
  player: PlayerState;
  peers: Map<string, LiveKitPeer>;
  presenceUsers: PresenceUser[];
  chatMessages: ChatMessage[];
  meetingStatuses: Map<string, MeetingStatus>;
  status: string;
  error: string | null;
  onMoveClick: (x: number, y: number) => void;
  onViewChange?: (view: ViewState) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OfficeCanvas({
  player,
  peers,
  presenceUsers,
  chatMessages,
  meetingStatuses,
  status,
  error,
  onMoveClick,
  onViewChange,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera view controls
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.6 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Report view changes to parent (for ChatBubbleOverlay positioning)
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startViewX: number;
    startViewY: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  // ── Rendering ───────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: vx, y: vy, zoom } = viewRef.current;

    // Background
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, w, h);

    // Floor area
    ctx.fillStyle = "#1e232c";
    ctx.fillRect(
      -vx * zoom + (w - FLOOR_W * zoom) / 2,
      -vy * zoom + (h - FLOOR_H * zoom) / 2,
      FLOOR_W * zoom,
      FLOOR_H * zoom,
    );

    const ox = -vx * zoom + (w - FLOOR_W * zoom) / 2;
    const oy = -vy * zoom + (h - FLOOR_H * zoom) / 2;

    // Zone backgrounds
    const drawZone = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * zoom, oy + y * zoom, w * zoom, h * zoom);
    };

    // Open-plan zones
    drawZone(40, 460, 580, 350, COLOURS.zoneCool);
    drawZone(1440, 460, 460, 350, COLOURS.zoneSage);
    drawZone(620, 460, 820, 400, COLOURS.zoneSage);
    drawZone(40, 290, 1000, 170, COLOURS.zoneCool);
    drawZone(1720, 290, 620, 170, COLOURS.zoneCool);
    drawZone(1000, 700, 1300, 180, COLOURS.zoneWarm);

    // Rooms
    for (const room of ROOMS) {
      const fill = roomFill(room.type);
      const border = roomBorder(room.type);
      const rx = ox + room.x * zoom;
      const ry = oy + room.y * zoom;
      const rw = room.w * zoom;
      const rh = room.h * zoom;

      // Room fill
      ctx.fillStyle = fill;
      ctx.fillRect(rx, ry, rw, rh);

      // Room border
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);

      // Room label
      ctx.fillStyle = COLOURS.textDim;
      ctx.font = `${Math.max(10, 12 * zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(room.name, rx + 6, ry + Math.max(14, 16 * zoom));

      // Room type badge
      const label = roomLabel(room.type);
      if (label) {
        ctx.font = `${Math.max(8, 10 * zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(rx + 4, ry + rh - 18 * zoom, tw + 8, 14 * zoom);
        ctx.fillStyle = COLOURS.textDim;
        ctx.fillText(label, rx + 8, ry + rh - 7 * zoom);
      }
    }

    // Desk dots in open plan areas
    const desks = [
      // Engineering pod
      [60, 490], [140, 490], [220, 490], [300, 490], [380, 490],
      [60, 560], [140, 560], [220, 560], [300, 560], [380, 560],
      [60, 630], [140, 630], [220, 630], [300, 630], [380, 630],
      [60, 700], [140, 700], [220, 700], [300, 700], [380, 700],
      // Sales pod
      [1480, 490], [1560, 490], [1640, 490], [1720, 490],
      [1480, 560], [1560, 560], [1640, 560], [1720, 560],
      [1480, 630], [1560, 630], [1640, 630], [1720, 630],
      [1480, 700], [1560, 700], [1640, 700], [1720, 700],
    ];
    for (const [dx, dy] of desks) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(ox + dx * zoom, oy + dy * zoom, 4 * zoom, 4 * zoom);
    }

    // Door markers
    const doors: [number, number, number, number][] = [
      [130, 270, 30, 6], [230, 270, 30, 6],
      [380, 230, 30, 6], [460, 230, 30, 6],
      [560, 200, 6, 30], [560, 140, 6, 30],
      [700, 200, 6, 30], [700, 140, 6, 30],
      [880, 270, 30, 6], [980, 270, 30, 6],
      [1180, 200, 6, 30], [1180, 140, 6, 30],
      [1340, 200, 6, 30], [1340, 140, 6, 30],
      [1520, 270, 30, 6], [1620, 270, 30, 6],
      [1800, 270, 30, 6], [1900, 270, 30, 6],
      [2020, 300, 30, 6], [2120, 300, 30, 6],
      [2260, 300, 6, 30], [2260, 220, 6, 30],
    ];
    for (const [dx, dy, dw, dh] of doors) {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(ox + dx * zoom, oy + dy * zoom, dw * zoom, dh * zoom);
    }

    // Peer avatars (LiveKit-connected)
    for (const [, peer] of peers) {
      const peerId = peer.identity ?? peer.name;
      drawAvatar(ctx, ox, oy, zoom, peer.x, peer.y, peer.color, peer.name, false, meetingStatuses?.get(peerId));
    }

    // Presence users (SSE — includes everyone online, even without LiveKit)
    for (const pu of presenceUsers) {
      // Skip if they're already shown as a LiveKit peer
      const isLivKitPeer = Array.from(peers.values()).some(
        (p) => p.identity === pu.user_id || p.name === pu.name,
      );
      if (isLivKitPeer) continue;
      // Skip self
      if (pu.user_id === player.id) continue;
      drawAvatar(
        ctx, ox, oy, zoom,
        pu.x, pu.y,
        COLOURS.green, // presence-only users show in green
        pu.name,
        false,
        meetingStatuses?.get(pu.user_id),
      );
    }

    // Player avatar (always on top)
    drawAvatar(ctx, ox, oy, zoom, player.x, player.y, PLAYER_COLOR, "Du", true);

    rafRef.current = requestAnimationFrame(draw);
  }, [player, peers, presenceUsers, meetingStatuses]);

  function drawAvatar(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    zoom: number,
    x: number,
    y: number,
    color: string,
    name: string,
    isSelf: boolean,
    meetingStatus?: MeetingStatus,
  ) {
    const r = (isSelf ? 14 : 12) * zoom;
    const px = ox + x * zoom;
    const py = oy + y * zoom;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(px, py + 4 * zoom, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    // Body circle
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (isSelf) {
      ctx.strokeStyle = COLOURS.accent;
      ctx.lineWidth = 2 * zoom;
      ctx.stroke();
    }

    // Initials
    const initials = name
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(8, 9 * zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, px, py);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    // Name label (only at sufficient zoom)
    if (zoom >= 0.5) {
      ctx.fillStyle = COLOURS.text;
      ctx.font = `${Math.max(9, 10 * zoom)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(name, px, py - r - 8 * zoom);
      ctx.textAlign = "start";
    }

    // Meeting status badge (below the avatar)
    if (!isSelf && meetingStatus && meetingStatus !== "available") {
      const badgeText = meetingStatus === "in_meeting" ? "I møde" : "Optaget";
      const badgeColor = meetingStatus === "in_meeting"
        ? COLOURS.accent
        : COLOURS.red;
      const fontSize = Math.max(8, 9 * zoom);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const tw = ctx.measureText(badgeText).width;
      const paddedW = tw + 6 * zoom;
      const paddedH = fontSize * 1.6;
      const bx = px - paddedW / 2;
      const by = py + r + 4 * zoom;

      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(bx, by, paddedW, paddedH, 3 * zoom);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, px, by + paddedH / 2);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    // Audio visualisation ring (if peer — handled by hook)
    // Placeholder: static ring for peers
    if (!isSelf) {
      ctx.beginPath();
      ctx.arc(px, py, r + 3 * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── Canvas rendering loop ──────────────────────────────────────────────────

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // ── Resize handling ─────────────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => {
      // Trigger re-draw on next frame
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Middle-click or right-click for panning
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startViewX: viewRef.current.x,
          startViewY: viewRef.current.y,
        };
        return;
      }

      // Left click → move to position
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: vx, y: vy, zoom } = viewRef.current;
      const ox = -vx * zoom + (rect.width - FLOOR_W * zoom) / 2;
      const oy = -vy * zoom + (rect.height - FLOOR_H * zoom) / 2;
      const worldX = (mx - ox) / zoom;
      const worldY = (my - oy) / zoom;
      onMoveClick(worldX, worldY);
    },
    [onMoveClick],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newVx = dragRef.current.startViewX - dx / viewRef.current.zoom;
    const newVy = dragRef.current.startViewY - dy / viewRef.current.zoom;
    setView((prev) => ({ ...prev, x: newVx, y: newVy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setView((prev) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.2, Math.min(2.0, prev.zoom * factor));
      return { ...prev, zoom: newZoom };
    });
  }, []);

  // Prevent right-click context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative flex-1 bg-[#1a1d23] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />

      {/* HUD overlay */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
        {/* Status */}
        <div className="flex items-center gap-2 text-xs" style={{ color: COLOURS.textDim }}>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background:
                status === "connected"
                  ? COLOURS.green
                  : status === "connecting"
                    ? COLOURS.amber
                    : COLOURS.red,
            }}
          />
          {status === "connected"
            ? `${peers.size + presenceUsers.filter(
                (pu) => !Array.from(peers.values()).some(
                  (p) => p.identity === pu.user_id || p.name === pu.name,
                ) && pu.user_id !== player.id,
              ).length} kollegaer online`
            : status === "connecting"
              ? "Forbinder..."
              : status === "error"
                ? `Fejl: ${error || ""}`
                : "Afbrudt"}
        </div>
        {/* Controls hint */}
        <div className="text-xs" style={{ color: COLOURS.textDim }}>
          Klik for at gå · WASD · Scroll for zoom · Midt-klik-træk for at panorere
        </div>
      </div>

      {/* Room legend */}
      <div
        className="absolute bottom-3 left-3 flex gap-3 text-xs pointer-events-none"
        style={{ color: COLOURS.textDim }}
      >
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOURS.roomMeeting, border: "1px solid rgba(91,155,213,0.25)" }} />
          Møde
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOURS.roomFocus, border: "1px solid rgba(239,83,80,0.25)" }} />
          Fokus
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOURS.roomSocial, border: "1px solid rgba(76,175,80,0.25)" }} />
          Social
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOURS.roomBg, border: "1px solid rgba(46,51,59,0.5)" }} />
          Åben
        </span>
      </div>
    </div>
  );
}