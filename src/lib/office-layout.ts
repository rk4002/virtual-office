// VirtualOffice — shared office layout and spatial audio constants
// Ported from prototype/prototype/spatial-audio-prototype.html

// --- Spatial audio constants ---
// Tuned for Danish office environments: moderate room sizes, typical
// desk proximity, balanced between privacy and spontaneous conversation.
export const NEAR_FIELD = 48;           // px — full volume within this radius (wider for desk adjacency)
export const MAX_DISTANCE = 400;        // px — silence beyond this
export const CONVERSATION_RADIUS = 72;  // px — conversation bonus radius (wider for natural flow)
export const CONVERSATION_BONUS = 1.4;  // +dB bonus within conversation radius
export const MOVE_SPEED = 200;          // px/s
export const POSITION_SYNC_HZ = 20;     // data channel push rate (reliable at 20 Hz)
export const INTERP_RATE = 0.15;        // lerp smoothing
export const MAX_SIMULTANEOUS = 20;     // cap at 20 simultaneous voices
export const GAIN_CUTOFF = 0.005;       // cull below this gain

// --- Floor dimensions ---
export const FLOOR_W = 2400;
export const FLOOR_H = 1350;
export const SPAWN = { x: 380, y: 700 };

// --- Room types ---
export type RoomType = "meeting" | "focus" | "social" | "open";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- Office layout ---
export const ROOMS: Room[] = [
  { id: "meeting-a", name: "Mødelokale A", type: "meeting", x: 60, y: 70, w: 240, h: 200 },
  { id: "meeting-b", name: "Mødelokale B", type: "meeting", x: 320, y: 70, w: 180, h: 160 },
  { id: "focus-1", name: "Fokus 1", type: "focus", x: 520, y: 70, w: 120, h: 130 },
  { id: "focus-2", name: "Fokus 2", type: "focus", x: 660, y: 70, w: 120, h: 130 },
  { id: "boardroom", name: "Bestyrelseslokale", type: "meeting", x: 800, y: 70, w: 320, h: 200 },
  { id: "office-dir", name: "Direktør", type: "focus", x: 1140, y: 70, w: 140, h: 130 },
  { id: "office-hr", name: "HR", type: "focus", x: 1300, y: 70, w: 140, h: 130 },
  { id: "training", name: "Træning", type: "meeting", x: 1460, y: 70, w: 240, h: 200 },
  { id: "brainstorm", name: "Brainstorm", type: "meeting", x: 1720, y: 70, w: 200, h: 200 },
  { id: "auditorium", name: "Auditorium", type: "meeting", x: 1940, y: 70, w: 420, h: 230 },
  { id: "kitchen", name: "Køkken", type: "social", x: 1000, y: 880, w: 420, h: 240 },
  { id: "cafeteria", name: "Kantine", type: "social", x: 1500, y: 880, w: 800, h: 380 },
  { id: "lounge", name: "Lounge", type: "social", x: 1000, y: 500, w: 420, h: 200 },
  { id: "eng-pod", name: "Engineering", type: "open", x: 40, y: 460, w: 580, h: 350 },
  { id: "sales-pod", name: "Salg", type: "open", x: 1440, y: 460, w: 460, h: 350 },
];

// --- Layout helpers ---
export function pointInRoom(px: number, py: number, room: Room): boolean {
  return px >= room.x && px <= room.x + room.w && py >= room.y && py <= room.y + room.h;
}

export function roomForPoint(x: number, y: number): Room | null {
  for (const r of ROOMS) {
    if (pointInRoom(x, y, r)) return r;
  }
  return null;
}

export function roomCenter(room: Room): { x: number; y: number } {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

// --- Peer / Player types ---
export interface Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

// --- Sample peer color palette ---
const PEER_COLORS = ["#7bc67e", "#5b8cb8", "#d4a857", "#b87bc6", "#c67b7b"];

export function randomPeerColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
}

export const PLAYER_COLOR = "#5b9bd5";