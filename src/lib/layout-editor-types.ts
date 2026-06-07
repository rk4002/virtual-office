// VirtualOffice — Layout editor state types
// Separate from office-layout.ts to keep the editor state self-contained.

import type { LayoutRoom } from "@/lib/db";

// ── Furniture items that users can place on the grid ──────────────────────
export type FurnitureKind =
  | "desk-single"      // Single desk (1x1)
  | "desk-double"      // Double desk (2x1)
  | "desk-cluster4"    // 4-desk cluster (2x2)
  | "meeting-table"    // Meeting table (3x2)
  | "boardroom-table"  // Large boardroom table (4x3)
  | "sofa"             // Lounge sofa (2x1)
  | "coffee-table"     // Coffee table (1x1)
  | "plant"            // Potted plant (1x1)
  | "whiteboard"       // Whiteboard (1x1, wall-mounted)
  | "bookshelf"        // Bookshelf (1x1)
  | "water-cooler"     // Water cooler (1x1)
  | "printer"          // Printer station (1x1);

export interface FurnitureDef {
  kind: FurnitureKind;
  label: string;         // Danish label for the palette
  w: number;             // Width in grid cells
  h: number;             // Height in grid cells
  color: string;         // Fill color
  category: "desk" | "meeting" | "lounge" | "utility" | "decor";
}

// ── Palette of available furniture ────────────────────────────────────────
export const FURNITURE_PALETTE: FurnitureDef[] = [
  { kind: "desk-single",      label: "Enkelt skrivebord",  w: 80,  h: 60,  color: "#5b9bd5", category: "desk" },
  { kind: "desk-double",      label: "Dobbelt skrivebord", w: 160, h: 60,  color: "#4a8bc2", category: "desk" },
  { kind: "desk-cluster4",    label: "4-personers klynge", w: 160, h: 140, color: "#3d7ab0", category: "desk" },
  { kind: "meeting-table",    label: "Mødebord (6 pers.)", w: 240, h: 140, color: "#4caf50", category: "meeting" },
  { kind: "boardroom-table",  label: "Bestyrelsesbord",    w: 320, h: 180, color: "#43a047", category: "meeting" },
  { kind: "sofa",             label: "Sofa",               w: 160, h: 80,  color: "#ffa726", category: "lounge" },
  { kind: "coffee-table",     label: "Kaffebord",          w: 80,  h: 60,  color: "#ff9800", category: "lounge" },
  { kind: "plant",            label: "Plante",             w: 40,  h: 40,  color: "#66bb6a", category: "decor" },
  { kind: "whiteboard",       label: "Whiteboard",         w: 80,  h: 20,  color: "#eee",    category: "utility" },
  { kind: "bookshelf",        label: "Reol",               w: 60,  h: 40,  color: "#8d6e63", category: "utility" },
  { kind: "water-cooler",     label: "Vandkøler",          w: 50,  h: 50,  color: "#26c6da", category: "utility" },
  { kind: "printer",          label: "Printer",            w: 60,  h: 60,  color: "#78909c", category: "utility" },
];

// ── Placement on the canvas ───────────────────────────────────────────────
export interface FurniturePlacement {
  id: string;           // Unique ID for this instance
  kind: FurnitureKind;
  x: number;            // Top-left pixel position on the floor
  y: number;
  label?: string;       // Optional user-defined label
  rotation?: 0 | 90 | 180 | 270;  // Future: rotation support
}

// ── Room placement (rooms are treated as a special furniture kind) ─────────
export interface RoomPlacement {
  id: string;
  name: string;
  type: "meeting" | "focus" | "social" | "open";
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Floor constants for the editor ────────────────────────────────────────
export const GRID_CELL = 20;      // px per grid cell (visual only — all positions are in px)
export const MIN_WIDTH = 1600;
export const MIN_HEIGHT = 900;
export const MAX_WIDTH = 4800;
export const MAX_HEIGHT = 2700;

// ── Editor mode ───────────────────────────────────────────────────────────
export type EditorMode = "select" | "place" | "room" | "delete";

export interface EditorState {
  mode: EditorMode;
  selectedId: string | null;       // Selected placement ID
  placingKind: FurnitureKind | null; // Furniture being placed (mode=place)
  placingRoom: { type: RoomPlacement["type"]; w: number; h: number } | null; // Room being placed (mode=room)
  placements: FurniturePlacement[];
  rooms: RoomPlacement[];
  floorWidth: number;
  floorHeight: number;
  undoStack: Array<{ placements: FurniturePlacement[]; rooms: RoomPlacement[] }>;
  redoStack: Array<{ placements: FurniturePlacement[]; rooms: RoomPlacement[] }>;
  maxUndo: number;
}