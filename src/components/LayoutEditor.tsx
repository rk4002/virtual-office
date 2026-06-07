"use client";

// VirtualOffice — 2D office layout editor with drag-and-drop
// Renders the floor via SVG, palette with furniture items users can drag onto
// the grid, select/move/delete operations, undo/redo, and save to the API.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FurnitureKind,
  FurniturePlacement,
  RoomPlacement,
  FURNITURE_PALETTE,
  FurnitureDef,
  GRID_CELL,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
} from "@/lib/layout-editor-types";
import type { LayoutRoom } from "@/lib/db";

// ── Colour / theme ────────────────────────────────────────────────────────
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
  floor: "#1e232c",
  gridColor: "rgba(255,255,255,0.03)",
};

// ── Layout shape saved to / loaded from the API ───────────────────────────
export interface SavedLayout {
  id?: string;
  name: string;
  floor_width: number;
  floor_height: number;
  rooms: LayoutRoom[];
  placements: FurniturePlacement[];
}

// ── Props ─────────────────────────────────────────────────────────────────
export interface LayoutEditorProps {
  initialLayout?: SavedLayout;
  onSave?: (layout: SavedLayout) => Promise<void>;
  onLoad?: (saveId: string) => Promise<SavedLayout | null>;
}

// ── Helpers ───────────────────────────────────────────────────────────────
let _nextId = 1;
function uid(): string {
  return `f${Date.now().toString(36)}-${(_nextId++).toString(36)}`;
}

function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function snapToGrid(v: number, cell: number = GRID_CELL): number {
  return Math.round(v / cell) * cell;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function LayoutEditor({
  initialLayout,
  onSave,
}: LayoutEditorProps) {
  // --- State ---
  const [floorWidth, setFloorWidth] = useState(
    initialLayout?.floor_width ?? 2400,
  );
  const [floorHeight, setFloorHeight] = useState(
    initialLayout?.floor_height ?? 1350,
  );
  const [layoutName, setLayoutName] = useState(initialLayout?.name ?? "Nyt layout");
  const [saveId, setSaveId] = useState<string | null>(initialLayout?.id ?? null);
  const [placements, setPlacementsRaw] = useState<FurniturePlacement[]>(
    initialLayout?.placements ?? [],
  );
  const [rooms, setRooms] = useState<RoomPlacement[]>(
    (initialLayout?.rooms ?? []).map((r) => ({
      id: `room-${r.id}`,
      name: r.name,
      type: r.type,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    })),
  );

  // Undo/redo
  const [undoStack, setUndoStack] = useState<
    Array<{ placements: FurniturePlacement[]; rooms: RoomPlacement[] }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{ placements: FurniturePlacement[]; rooms: RoomPlacement[] }>
  >([]);

  // Wrap setPlacements to push undo
  const setPlacements = useCallback(
    (updater: FurniturePlacement[] | ((prev: FurniturePlacement[]) => FurniturePlacement[])) => {
      setPlacementsRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (next !== prev) {
          setUndoStack((s) => [...s.slice(-49), { placements: prev, rooms }]);
          setRedoStack([]);
        }
        return next;
      });
    },
    [rooms],
  );

  const setRoomsWithUndo = useCallback(
    (updater: RoomPlacement[] | ((prev: RoomPlacement[]) => RoomPlacement[])) => {
      setRooms((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (next !== prev) {
          setUndoStack((s) => [...s.slice(-49), { placements, rooms: prev }]);
          setRedoStack([]);
        }
        return next;
      });
    },
    [placements],
  );

  // --- Interaction state ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "place" | "room" | "delete">("select");
  const [placingKind, setPlacingKind] = useState<FurnitureKind | null>(null);
  const [placingRoomType, setPlacingRoomType] = useState<RoomPlacement["type"]>("meeting");
  const [placingRoomW, setPlacingRoomW] = useState(240);
  const [placingRoomH, setPlacingRoomH] = useState(200);

  // Drag state
  const dragRef = useRef<{
    kind: "move" | "place" | "room-place" | "room-resize" | "resize-sw" | "resize-se";
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
    origW?: number;
    origH?: number;
    id?: string;
  } | null>(null);

  // Pan / zoom
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.5 });
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  // --- Derived ---
  const palDef = placingKind
    ? FURNITURE_PALETTE.find((f) => f.kind === placingKind)
    : null;

  // --- Mouse -> floor coords ---
  const svgRef = useRef<SVGSVGElement>(null);

  const clientToFloor = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const fx = (mx - view.x) / view.zoom;
      const fy = (my - view.y) / view.zoom;
      return { x: fx, y: fy };
    },
    [view],
  );

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((s) => [...s, { placements, rooms }]);
    setPlacementsRaw(prev.placements);
    setRooms(prev.rooms);
    setUndoStack((s) => s.slice(0, -1));
    setSelectedId(null);
  }, [undoStack, placements, rooms]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, { placements, rooms }]);
    setPlacementsRaw(next.placements);
    setRooms(next.rooms);
    setRedoStack((s) => s.slice(0, -1));
    setSelectedId(null);
  }, [redoStack, placements, rooms]);

  // --- Keyboard ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Mode keys
      if (e.key === "Escape") {
        setMode("select");
        setPlacingKind(null);
        setSelectedId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          setPlacements((prev) => prev.filter((p) => p.id !== selectedId));
          setSelectedId(null);
        }
        return;
      }
      // Arrow keys: nudge selected item 20px
      if (selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -20 : e.key === "ArrowRight" ? 20 : 0;
        const dy = e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0;
        setPlacements((prev) =>
          prev.map((p) =>
            p.id === selectedId
              ? { ...p, x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) }
              : p,
          ),
        );
        // Also nudge selected room
        setRoomsWithUndo((prev) =>
          prev.map((r) =>
            r.id === selectedId
              ? { ...r, x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy) }
              : r,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, undo, redo, setPlacements, setRoomsWithUndo]);

  // --- Mouse handlers on SVG ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Middle-click = pan
      if (e.button === 1) {
        e.preventDefault();
        panRef.current = {
          sx: e.clientX,
          sy: e.clientY,
          vx: view.x,
          vy: view.y,
        };
        return;
      }

      const { x, y } = clientToFloor(e.clientX, e.clientY);

      // --- Place mode ---
      if (mode === "place" && palDef) {
        const id = uid();
        const newFx = snapToGrid(x);
        const newFy = snapToGrid(y);
        setPlacements((prev) => [
          ...prev,
          { id, kind: palDef.kind, x: newFx, y: newFy },
        ]);
        setSelectedId(id);
        // Start moving it immediately
        dragRef.current = {
          kind: "move",
          startX: e.clientX,
          startY: e.clientY,
          origX: newFx,
          origY: newFy,
          id,
        };
        return;
      }

      // --- Room place mode ---
      if (mode === "room") {
        const id = `room-${uid()}`;
        const newRx = snapToGrid(x);
        const newRy = snapToGrid(y);
        setRoomsWithUndo((prev) => [
          ...prev,
          {
            id,
            name: `Rum ${prev.length + 1}`,
            type: placingRoomType,
            x: newRx,
            y: newRy,
            w: placingRoomW,
            h: placingRoomH,
          },
        ]);
        setSelectedId(id);
        dragRef.current = {
          kind: "move",
          startX: e.clientX,
          startY: e.clientY,
          origX: newRx,
          origY: newRy,
          id,
        };
        return;
      }

      // --- Delete mode ---
      if (mode === "delete") {
        // Check furniture
        for (let i = placements.length - 1; i >= 0; i--) {
          const p = placements[i];
          const def = FURNITURE_PALETTE.find((d) => d.kind === p.kind);
          if (!def) continue;
          if (pointInRect(x, y, p.x, p.y, def.w, def.h)) {
            setPlacements((prev) => prev.filter((f) => f.id !== p.id));
            return;
          }
        }
        // Check rooms
        for (let i = rooms.length - 1; i >= 0; i--) {
          const r = rooms[i];
          if (pointInRect(x, y, r.x, r.y, r.w, r.h)) {
            setRoomsWithUndo((prev) => prev.filter((rm) => rm.id !== r.id));
            return;
          }
        }
        return;
      }

      // --- Select mode: hit-test items (topmost first) ---
      // Rooms first (larger, behind), then furniture (in front)
      for (let i = rooms.length - 1; i >= 0; i--) {
        const r = rooms[i];
        // Check resize handles (bottom-right corner)
        const hsz = 12 / view.zoom;
        if (
          x >= r.x + r.w - hsz &&
          x <= r.x + r.w + hsz &&
          y >= r.y + r.h - hsz &&
          y <= r.y + r.h + hsz
        ) {
          dragRef.current = {
            kind: "room-resize",
            startX: e.clientX,
            startY: e.clientY,
            origW: r.w,
            origH: r.h,
            id: r.id,
          };
          setSelectedId(r.id);
          return;
        }
        if (pointInRect(x, y, r.x, r.y, r.w, r.h)) {
          dragRef.current = {
            kind: "move",
            startX: e.clientX,
            startY: e.clientY,
            origX: r.x,
            origY: r.y,
            id: r.id,
          };
          setSelectedId(r.id);
          return;
        }
      }
      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i];
        const def = FURNITURE_PALETTE.find((d) => d.kind === p.kind);
        if (!def) continue;
        if (pointInRect(x, y, p.x, p.y, def.w, def.h)) {
          dragRef.current = {
            kind: "move",
            startX: e.clientX,
            startY: e.clientY,
            origX: p.x,
            origY: p.y,
            id: p.id,
          };
          setSelectedId(p.id);
          break;
        }
      }
    },
    [
      clientToFloor,
      mode,
      palDef,
      placingRoomType,
      placingRoomW,
      placingRoomH,
      placements,
      rooms,
      view,
      setPlacements,
      setRoomsWithUndo,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Pan
      if (panRef.current) {
        const dx = e.clientX - panRef.current.sx;
        const dy = e.clientY - panRef.current.sy;
        setView({ x: panRef.current.vx + dx, y: panRef.current.vy + dy, zoom: view.zoom });
        return;
      }

      const d = dragRef.current;
      if (!d) return;

      const dx = (e.clientX - d.startX) / view.zoom;
      const dy = (e.clientY - d.startY) / view.zoom;

      if (d.kind === "room-resize" && d.id && d.origW && d.origH) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === d.id
              ? { ...r, w: snapToGrid(Math.max(40, (d.origW ?? r.w) + dx)), h: snapToGrid(Math.max(40, (d.origH ?? r.h) + dy)) }
              : r,
          ),
        );
        return;
      }

      if (d.kind === "move" && d.id) {
        const nx = snapToGrid((d.origX ?? 0) + dx);
        const ny = snapToGrid((d.origY ?? 0) + dy);
        // Check if it's a furniture or room
        const isPlacement = placements.some((p) => p.id === d.id);
        if (isPlacement) {
          setPlacements((prev) =>
            prev.map((p) => (p.id === d.id ? { ...p, x: Math.max(0, nx), y: Math.max(0, ny) } : p)),
          );
        } else {
          setRooms((prev) =>
            prev.map((r) => (r.id === d.id ? { ...r, x: Math.max(0, nx), y: Math.max(0, ny) } : r)),
          );
        }
        return;
      }
    },
    [view, placements],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      // Push undo on drag end
      if (dragRef.current.kind === "move" || dragRef.current.kind === "room-resize") {
        setUndoStack((s) => [...s.slice(-49), { placements, rooms }]);
        setRedoStack([]);
      }
    }
    dragRef.current = null;
    panRef.current = null;
  }, [placements, rooms]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setView((prev) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      return {
        ...prev,
        zoom: Math.max(0.15, Math.min(2.0, prev.zoom * factor)),
      };
    });
  }, []);

  // --- Save / Load ---
  const handleSave = useCallback(async () => {
    const roomsForApi: LayoutRoom[] = rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    }));

    const body = JSON.stringify({
      name: layoutName,
      floor_width: floorWidth,
      floor_height: floorHeight,
      rooms: roomsForApi,
    });

    try {
      let resp: Response;
      if (saveId) {
        resp = await fetch(`/api/layouts?id=${saveId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } else {
        resp = await fetch("/api/layouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      }
      if (resp.ok) {
        const data = await resp.json();
        setSaveId(data.id);
        alert("Layout gemt!");
      } else {
        const err = await resp.json().catch(() => ({ error: "Ukendt fejl" }));
        alert(`Fejl: ${err.error ?? "Ukendt"}`);
      }
    } catch {
      alert("Netværksfejl — kunne ikke gemme.");
    }
  }, [layoutName, floorWidth, floorHeight, rooms, saveId]);

  // --- Floor size change ---
  const handleFloorResize = (w: number, h: number) => {
    setFloorWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));
    setFloorHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)));
  };

  // --- Render ---
  return (
    <div className="flex h-screen" style={{ background: C.bg, color: C.text }}>
      {/* ── Left palette ── */}
      <div
        className="flex flex-col w-56 flex-shrink-0 border-r overflow-y-auto p-3 gap-2"
        style={{ background: C.surface, borderColor: C.border }}
      >
        {/* Layout name */}
        <input
          className="px-2 py-1 rounded text-sm border outline-none"
          style={{
            background: C.bg,
            borderColor: C.border,
            color: C.text,
          }}
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          placeholder="Layout navn"
        />

        {/* Mode buttons */}
        <div className="flex gap-1 flex-wrap">
          {(
            [
              ["select", "🔽 Vælg"],
              ["place", "🪑 Placer"],
              ["room", "🏠 Rum"],
              ["delete", "🗑️ Slet"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setPlacingKind(null);
              }}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: mode === m ? C.accent : C.border,
                color: mode === m ? "#fff" : C.textDim,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Room config (when mode=room) */}
        {mode === "room" && (
          <div className="flex flex-col gap-1 text-xs" style={{ color: C.textDim }}>
            <label>Rum type</label>
            <select
              value={placingRoomType}
              onChange={(e) => setPlacingRoomType(e.target.value as RoomPlacement["type"])}
              className="px-1 py-1 rounded text-xs"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
            >
              <option value="meeting">Mødelokale</option>
              <option value="focus">Fokusrum</option>
              <option value="social">Hyggekrog</option>
              <option value="open">Åbent kontor</option>
            </select>
            <label>Bredde (px)</label>
            <input
              type="number"
              value={placingRoomW}
              onChange={(e) => setPlacingRoomW(Number(e.target.value))}
              className="px-1 py-1 rounded text-xs"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
            />
            <label>Højde (px)</label>
            <input
              type="number"
              value={placingRoomH}
              onChange={(e) => setPlacingRoomH(Number(e.target.value))}
              className="px-1 py-1 rounded text-xs"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
        )}

        {/* Furniture palette (only in place mode) */}
        {mode === "place" && (
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-xs" style={{ color: C.textDim }}>
              Vælg møbel — klik på gulvet for at placere
            </span>
            {FURNITURE_PALETTE.map((f) => (
              <button
                key={f.kind}
                onClick={() => setPlacingKind(f.kind)}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors"
                style={{
                  background: placingKind === f.kind ? C.accent + "20" : "transparent",
                  border:
                    placingKind === f.kind
                      ? `1px solid ${C.accent}`
                      : "1px solid transparent",
                  color: C.text,
                }}
                title={`${f.w}x${f.h}`}
              >
                <span
                  className="inline-block flex-shrink-0 rounded-sm"
                  style={{
                    width: 14,
                    height: 14,
                    background: f.color,
                  }}
                />
                <span className="truncate">{f.label}</span>
                <span className="ml-auto" style={{ color: C.textDim }}>
                  {f.w}×{f.h}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Room list overview (select mode) ── */}
        {mode === "select" && (
          <>
            <div className="pt-2 border-t" style={{ borderColor: C.border }}>
              <span className="text-xs" style={{ color: C.textDim }}>
                Rum ({rooms.length})
              </span>
              {rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setMode("select");
                  }}
                  className="flex items-center gap-1 px-1 py-0.5 rounded text-xs w-full text-left"
                  style={{
                    background: selectedId === r.id ? C.accent + "20" : "transparent",
                    color: C.textDim,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        r.type === "meeting"
                          ? "#5b9bd5"
                          : r.type === "focus"
                            ? "#ef5350"
                            : r.type === "social"
                              ? "#4caf50"
                              : "#888c94",
                    }}
                  />
                  <span className="truncate">{r.name}</span>
                  <span className="ml-auto" style={{ color: C.textDim }}>
                    {r.w}×{r.h}
                  </span>
                </button>
              ))}
            </div>

            {/* Furniture overview */}
            <div className="pt-1 border-t" style={{ borderColor: C.border }}>
              <span className="text-xs" style={{ color: C.textDim }}>
                Møbler ({placements.length})
              </span>
              {placements.slice(0, 30).map((p) => {
                const def = FURNITURE_PALETTE.find((f) => f.kind === p.kind);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setMode("select");
                    }}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-xs w-full text-left"
                    style={{
                      background: selectedId === p.id ? C.accent + "20" : "transparent",
                      color: C.textDim,
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: def?.color ?? "#666" }}
                    />
                    <span className="truncate">{def?.label ?? p.kind}</span>
                    <span className="ml-auto" style={{ color: C.textDim }}>
                      {p.x},{p.y}
                    </span>
                  </button>
                );
              })}
              {placements.length > 30 && (
                <span className="text-xs" style={{ color: C.textDim }}>
                  +{placements.length - 30} flere...
                </span>
              )}
            </div>
          </>
        )}

        {/* ── Floor size controls ── */}
        <div className="pt-2 border-t" style={{ borderColor: C.border }}>
          <span className="text-xs" style={{ color: C.textDim }}>
            Etage størrelse
          </span>
          <div className="flex gap-1">
            <input
              type="number"
              value={floorWidth}
              onChange={(e) => handleFloorResize(Number(e.target.value), floorHeight)}
              min={MIN_WIDTH}
              max={MAX_WIDTH}
              className="w-full px-1 py-1 rounded text-xs"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="Bredde"
            />
            <input
              type="number"
              value={floorHeight}
              onChange={(e) => handleFloorResize(floorWidth, Number(e.target.value))}
              min={MIN_HEIGHT}
              max={MAX_HEIGHT}
              className="w-full px-1 py-1 rounded text-xs"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="Højde"
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-1 pt-2">
          <button
            onClick={handleSave}
            className="px-2 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ background: C.green, color: "#fff" }}
          >
            💾 Gem layout
          </button>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30"
            style={{ background: C.border, color: C.text }}
          >
            ↩️ Fortryd
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30"
            style={{ background: C.border, color: C.text }}
          >
            ↪️ Annuller fortryd
          </button>
          {mode === "place" && palDef && (
            <span className="text-xs pt-1" style={{ color: C.textDim }}>
              {palDef.label} ({palDef.w}×{palDef.h} px) — klik på gulvet for
              at placere
            </span>
          )}
        </div>
      </div>

      {/* ── SVG canvas ── */}
      <div className="flex-1 overflow-hidden relative">
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: mode === "delete" ? "crosshair" : "default" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <defs>
            <pattern id="grid" width={GRID_CELL} height={GRID_CELL} patternUnits="userSpaceOnUse">
              <path
                d={`M ${GRID_CELL} 0 L 0 0 0 ${GRID_CELL}`}
                fill="none"
                stroke={C.gridColor}
                strokeWidth="1"
              />
            </pattern>
            {/* Room type fills */}
            <filter id="dropshadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Viewport transform */}
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
            {/* ── Floor ── */}
            <rect
              x={0}
              y={0}
              width={floorWidth}
              height={floorHeight}
              fill={C.floor}
              stroke={C.border}
              strokeWidth={1 / view.zoom}
            />
            <rect x={0} y={0} width={floorWidth} height={floorHeight} fill="url(#grid)" />

            {/* ── Rooms ── */}
            {rooms.map((r) => {
              const isSelected = selectedId === r.id;
              const roomFill =
                r.type === "meeting"
                  ? "rgba(91,155,213,0.12)"
                  : r.type === "focus"
                    ? "rgba(239,83,80,0.12)"
                    : r.type === "social"
                      ? "rgba(76,175,80,0.12)"
                      : "rgba(30,35,44,0.6)";
              const roomBdr =
                r.type === "meeting"
                  ? "rgba(91,155,213,0.35)"
                  : r.type === "focus"
                    ? "rgba(239,83,80,0.35)"
                    : r.type === "social"
                      ? "rgba(76,175,80,0.35)"
                      : "rgba(46,51,59,0.5)";
              return (
                <g key={r.id}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={roomFill}
                    stroke={isSelected ? C.accent : roomBdr}
                    strokeWidth={isSelected ? 2 : 1}
                    rx={4}
                  />
                  <text
                    x={r.x + 6}
                    y={r.y + 16}
                    fill={C.textDim}
                    fontSize={12}
                    fontFamily="system-ui, sans-serif"
                  >
                    {r.name}
                  </text>
                  <text
                    x={r.x + 6}
                    y={r.y + 32}
                    fill={C.textDim}
                    fontSize={10}
                    fontFamily="system-ui, sans-serif"
                  >
                    {r.type === "meeting"
                      ? "Møde"
                      : r.type === "focus"
                        ? "Fokus"
                        : r.type === "social"
                          ? "Hygge"
                          : "Åben"}
                    · {r.w}×{r.h}
                  </text>
                  {/* Resize handle */}
                  {isSelected && (
                    <rect
                      x={r.x + r.w - 12}
                      y={r.y + r.h - 12}
                      width={12}
                      height={12}
                      fill={C.accent}
                      rx={2}
                      style={{ cursor: "nwse-resize" }}
                    />
                  )}
                </g>
              );
            })}

            {/* ── Furniture placements ── */}
            {placements.map((p) => {
              const def = FURNITURE_PALETTE.find((f) => f.kind === p.kind);
              if (!def) return null;
              const isSelected = selectedId === p.id;
              const r = 4; // corner radius
              return (
                <g key={p.id} filter={isSelected ? "url(#dropshadow)" : undefined}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={def.w}
                    height={def.h}
                    fill={def.color}
                    rx={r}
                    stroke={isSelected ? C.accent : "rgba(255,255,255,0.1)"}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={0.85}
                  />
                  {/* Icon / label */}
                  <text
                    x={p.x + def.w / 2}
                    y={p.y + def.h / 2 + 1}
                    fill="#fff"
                    fontSize={Math.min(11, def.h * 0.22)}
                    fontFamily="system-ui, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                  >
                    {furnitureEmoji(def.kind)}
                    {def.w >= 80 && ` ${def.label}`}
                  </text>
                  {/* Selected highlight: corner handles */}
                  {isSelected && (
                    <>
                      <rect
                        x={p.x - 3}
                        y={p.y - 3}
                        width={6}
                        height={6}
                        fill={C.accent}
                        rx={1}
                      />
                      <rect
                        x={p.x + def.w - 3}
                        y={p.y + def.h - 3}
                        width={6}
                        height={6}
                        fill={C.accent}
                        rx={1}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* ── Ghost preview for placing furniture ── */}
            {mode === "place" && palDef && (
              <rect
                x={0}
                y={0}
                width={palDef.w}
                height={palDef.h}
                fill={palDef.color}
                opacity={0.3}
                rx={4}
                pointerEvents="none"
                style={{ visibility: "hidden" }}
              />
            )}
          </g>
        </svg>

        {/* ── HUD overlay ── */}
        <div
          className="absolute bottom-3 left-3 flex gap-4 text-xs pointer-events-none"
          style={{ color: C.textDim }}
        >
          <span>
            🪑 {placements.length} møbler · 🏠 {rooms.length} rum
          </span>
          <span>
            {floorWidth}×{floorHeight} px
          </span>
          <span>
            Mode:{" "}
            {mode === "select"
              ? "Vælg"
              : mode === "place"
                ? "Placer"
                : mode === "room"
                  ? "Rum"
                  : "Slet"}
          </span>
          <span>
            Esc: afbryd · Ctrl+Z: fortryd · Ctrl+Shift+Z: annuller fortryd ·
            Ctrl+S: gem
          </span>
          {placingKind && (
            <span>
              Placerer: {palDef?.label ?? placingKind} — klik på gulvet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Furniture emoji mapping ───────────────────────────────────────────────
function furnitureEmoji(kind: FurnitureKind): string {
  switch (kind) {
    case "desk-single":
      return "🖥️";
    case "desk-double":
      return "🖥️🖥️";
    case "desk-cluster4":
      return "👥";
    case "meeting-table":
      return "📊";
    case "boardroom-table":
      return "🏛️";
    case "sofa":
      return "🛋️";
    case "coffee-table":
      return "☕";
    case "plant":
      return "🌿";
    case "whiteboard":
      return "📋";
    case "bookshelf":
      return "📚";
    case "water-cooler":
      return "💧";
    case "printer":
      return "🖨️";
    default:
      return "";
  }
}