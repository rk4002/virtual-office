"use client";

// VirtualOffice — shared whiteboard for meeting rooms
// Canvas-based freehand drawing with color picker, brush size,
// eraser, undo/redo, and clear. Designed to be overlaid as a
// full-screen panel when users are in a meeting room.
//
// Future: sync strokes via LiveKit data channels for real-time
// collaboration across participants in the same room.

import { useCallback, useEffect, useRef, useState } from "react";

// ── Colour / theme (matching OfficeCanvas) ───────────────────────────────
const C = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
  green: "#4caf50",
  red: "#ef5350",
  amber: "#ffa726",
  white: "#ffffff",
};

const PALETTE = [
  "#ffffff",
  "#ef5350",
  "#ffa726",
  "#fdd835",
  "#66bb6a",
  "#5b9bd5",
  "#7e57c2",
  "#8d6e63",
  "#212121",
];

const DEFAULT_BRUSH = { color: "#ffffff", size: 3 };

// ── Types ────────────────────────────────────────────────────────────────

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

export interface WhiteboardProps {
  roomName: string;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function pointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) {
    // Single point: draw a small circle
    const p = stroke.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    return;
  }

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

// ── Component ────────────────────────────────────────────────────────────

export default function Whiteboard({ roomName, isOpen, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [color, setColor] = useState(DEFAULT_BRUSH.color);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH.size);
  const [mode, setMode] = useState<"draw" | "erase">("draw");

  // Stroke history
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  // Redo stack (cleared on new stroke)
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  // Current in-progress stroke
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Eraser position (shown as cursor circle)
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);

  // ── Canvas rendering ──────────────────────────────────────────────────

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background (slightly lighter than bg so strokes are visible)
    ctx.fillStyle = "#1e232c";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw all strokes
    for (const s of strokes) {
      drawStroke(ctx, s);
    }
  }, [strokes]);

  // Resize handler
  useEffect(() => {
    if (!isOpen) return;
    redrawAll();
    const onResize = () => redrawAll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, redrawAll]);

  // Re-render when strokes change
  useEffect(() => {
    if (!isOpen) return;
    redrawAll();
  }, [strokes, isOpen, redrawAll]);

  // ── Mouse / touch handlers ────────────────────────────────────────────

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);

      const pt = getCanvasPoint(e.clientX, e.clientY);
      drawingRef.current = true;

      // Eraser mode
      if (mode === "erase") {
        // Eraser cursor
        setEraserPos(pt);

        // Erase strokes that intersect the eraser circle
        const eraserRadius = Math.max(10, brushSize * 2);
        const remaining: Stroke[] = [];
        for (const s of strokesRef.current) {
          const hits = s.points.some((p) =>
            pointInCircle(p.x, p.y, pt.x, pt.y, eraserRadius),
          );
          if (!hits) remaining.push(s);
        }
        if (remaining.length !== strokesRef.current.length) {
          setStrokes(remaining);
          setRedoStack([]);
        }
        return;
      }

      // Draw mode: start new stroke
      const newStroke: Stroke = { points: [pt], color, size: brushSize };
      currentStrokeRef.current = newStroke;
      setRedoStack([]);
      setStrokes((prev) => [...prev, newStroke]);
    },
    [getCanvasPoint, mode, color, brushSize],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = getCanvasPoint(e.clientX, e.clientY);

      if (mode === "erase") {
        setEraserPos(pt);

        if (drawingRef.current) {
          const eraserRadius = Math.max(10, brushSize * 2);
          setStrokes((prev) => {
            const remaining: Stroke[] = [];
            for (const s of prev) {
              const hits = s.points.some((p) =>
                pointInCircle(p.x, p.y, pt.x, pt.y, eraserRadius),
              );
              if (!hits) remaining.push(s);
            }
            return remaining;
          });
        }
        return;
      }

      if (!drawingRef.current || !currentStrokeRef.current) return;
      setStrokes((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) {
          updated[updated.length - 1] = {
            ...last,
            points: [...last.points, pt],
          };
        }
        return updated;
      });
    },
    [getCanvasPoint, mode, brushSize],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.releasePointerCapture(e.pointerId);

      drawingRef.current = false;
      currentStrokeRef.current = null;
      setEraserPos(null);
    },
    [],
  );

  // ── Undo / Redo ───────────────────────────────────────────────────────

  const undo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((rs) => [last, ...rs]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setStrokes((s) => [...s, next]);
      return prev.slice(1);
    });
  }, []);

  const clear = useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
  }, [strokes.length]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, undo, redo, onClose]);

  // ── Render ────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: C.bg }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-3"
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Left: room name + mode */}
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold" style={{ color: C.text }}>
            🎨 {roomName}
          </h2>

          <div
            className="flex rounded-md overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            <button
              className="px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: mode === "draw" ? C.accent : "transparent",
                color: mode === "draw" ? "#fff" : C.textDim,
              }}
              onClick={() => { setMode("draw"); setEraserPos(null); }}
            >
              ✏️ Tegn
            </button>
            <button
              className="px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: mode === "erase" ? C.accent : "transparent",
                color: mode === "erase" ? "#fff" : C.textDim,
              }}
              onClick={() => setMode("erase")}
            >
              🧹 Slet
            </button>
          </div>
        </div>

        {/* Center: color palette (shown in draw mode) */}
        {mode === "draw" && (
          <div className="flex items-center gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: color === c ? C.accent : C.border,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                }}
                onClick={() => setColor(c)}
                aria-label={`Farve ${c}`}
              />
            ))}
            {/* Brush size */}
            <div
              className="w-px h-6 mx-1"
              style={{ background: C.border }}
            />
            <input
              type="range"
              min={1}
              max={20}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20"
              style={{ accentColor: C.accent }}
              aria-label="Penselstørrelse"
            />
            <span className="text-xs" style={{ color: C.textDim, minWidth: "24px" }}>
              {brushSize}px
            </span>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: C.border,
              color: C.text,
            }}
            onClick={undo}
            disabled={strokes.length === 0}
            title="Fortryd (Ctrl+Z)"
          >
            ↩ Fortryd
          </button>
          <button
            className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: C.border,
              color: C.text,
            }}
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Annuller fortryd (Ctrl+Shift+Z)"
          >
            ↪ Gentag
          </button>
          <button
            className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              background: C.red,
              color: "#fff",
            }}
            onClick={clear}
            disabled={strokes.length === 0}
            title="Ryd tavle"
          >
            🗑 Ryd
          </button>
          <button
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              background: C.accent,
              color: "#fff",
            }}
            onClick={onClose}
            title="Luk (Esc)"
          >
            ✕ Luk
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: mode === "erase" ? "none" : "crosshair",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Eraser indicator (follows cursor in erase mode) */}
        {mode === "erase" && eraserPos && (
          <div
            className="absolute pointer-events-none rounded-full border-2"
            style={{
              left: eraserPos.x,
              top: eraserPos.y,
              width: Math.max(20, brushSize * 4),
              height: Math.max(20, brushSize * 4),
              transform: "translate(-50%, -50%)",
              borderColor: C.red,
              background: "rgba(239, 83, 80, 0.1)",
            }}
          />
        )}
      </div>

      {/* Footer hint */}
      <div
        className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
        style={{
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <span className="text-xs" style={{ color: C.textDim }}>
          Ctrl+Z fortryd · Ctrl+Shift+Z gentag · Esc luk · {strokes.length} streger
        </span>
        <span className="text-xs" style={{ color: C.textDim }}>
          {mode === "erase"
            ? "Klik og træk for at slette streger"
            : "Klik og træk for at tegne"}
        </span>
      </div>
    </div>
  );
}