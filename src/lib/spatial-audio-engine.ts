// VirtualOffice — spatial audio engine (Web Audio API)
// Pure logic ported from prototype — handles inverse-square falloff,
// zone-gated mixing, and stereo panning.
// This is framework-agnostic; the React integration lives in useSpatialAudio.ts.

import {
  NEAR_FIELD,
  MAX_DISTANCE,
  CONVERSATION_RADIUS,
  CONVERSATION_BONUS,
  GAIN_CUTOFF,
  MAX_SIMULTANEOUS,
  Room,
  RoomType,
  roomForPoint,
} from "@/lib/office-layout";

// --- Utility ---
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// --- Inverse-square falloff with near-field plateau ---
export function attenuationGain(dist: number): number {
  if (dist <= NEAR_FIELD) return 1.0;
  if (dist >= MAX_DISTANCE) return 0.0;
  return (NEAR_FIELD / dist) ** 2;
}

// --- Conversation proximity bonus ---
export function conversationMultiplier(dist: number): number {
  return dist <= CONVERSATION_RADIUS ? CONVERSATION_BONUS : 1.0;
}

// --- Zone mixing strategy ---
export type ZoneMix = "same-room" | "conference" | "silence" | "boosted" | "open";

export function zoneMixFor(sourceRoom: Room | null, listenerRoom: Room | null): ZoneMix {
  if (!sourceRoom || !listenerRoom) return "open";
  if (sourceRoom.id === listenerRoom.id) return "same-room";
  // Meeting rooms: conference mix between meeting rooms
  if (
    sourceRoom.type === "meeting" &&
    listenerRoom.type === "meeting" &&
    sourceRoom.id === listenerRoom.id
  )
    return "conference";
  // Focus rooms: silence both ways
  if (sourceRoom.type === "focus" || listenerRoom.type === "focus") return "silence";
  // Social zones: boosted (reduced falloff)
  if (sourceRoom.type === "social" || listenerRoom.type === "social") return "boosted";
  return "open";
}

// --- Equal-power stereo panning based on horizontal offset ---
export function computePan(dx: number): number {
  const norm = Math.max(-1, Math.min(1, dx / MAX_DISTANCE));
  return Math.sin(norm * Math.PI / 2);
}

// --- Full spatial mix computation ---
export interface SpatialMixResult {
  peerId: string;
  gain: number;  // 0 to 1
  pan: number;   // -1 (left) to 1 (right)
  zone: ZoneMix;
  dist: number;
}

export function computeSpatialMix(
  listener: { x: number; y: number },
  peers: Map<string, { x: number; y: number }>,
): SpatialMixResult[] {
  const listenerRoom = roomForPoint(listener.x, listener.y);

  // Score all peers by distance
  type ScoredPeer = { peerId: string; dist: number };
  const scored: ScoredPeer[] = [];
  for (const [peerId, peer] of peers) {
    scored.push({ peerId, dist: distance(listener, peer) });
  }

  // Sort closest first
  scored.sort((a, b) => a.dist - b.dist);

  const results: SpatialMixResult[] = [];
  let activeCount = 0;

  for (const { peerId, dist } of scored) {
    const peer = peers.get(peerId)!;
    const dx = peer.x - listener.x;
    const sourceRoom = roomForPoint(peer.x, peer.y);
    const mix = zoneMixFor(sourceRoom, listenerRoom);

    let gain: number;
    if (mix === "silence") {
      gain = 0;
    } else if (mix === "same-room" || mix === "conference") {
      gain = 1.0;
    } else {
      gain = attenuationGain(dist);
      gain *= conversationMultiplier(dist);
      if (mix === "boosted") gain = Math.min(1.0, gain * 2.0);
    }

    // Cull below cutoff or if over cap
    if (gain < GAIN_CUTOFF || activeCount >= MAX_SIMULTANEOUS) {
      gain = 0;
    }

    if (gain > 0) activeCount++;

    const pan = computePan(dx);

    results.push({ peerId, gain, pan, zone: mix, dist });
  }

  return results;
}

// --- AudioContext helper ---
let _audioContext: AudioContext | null = null;

export function ensureAudioContext(): AudioContext {
  if (!_audioContext) {
    _audioContext = new AudioContext();
  }
  if (_audioContext.state === "suspended") {
    _audioContext.resume();
  }
  return _audioContext;
}

export function getAudioContext(): AudioContext | null {
  return _audioContext;
}

export async function closeAudioContext(): Promise<void> {
  if (_audioContext) {
    await _audioContext.close();
    _audioContext = null;
  }
}

// --- Web Audio node management for a single peer track ---
export interface SpatialAudioNodes {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  stream: MediaStream;
}

export function createSpatialNode(track: MediaStreamTrack): SpatialAudioNodes | null {
  const ctx = ensureAudioContext();

  const stream = new MediaStream([track]);
  const source = ctx.createMediaStreamSource(stream);

  const panner = ctx.createStereoPanner();
  panner.pan.value = 0;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  // Chain: source -> gain -> panner -> destination
  source.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  return { source, gain, panner, stream };
}

export function disposeSpatialNode(nodes: SpatialAudioNodes | null): void {
  if (!nodes) return;
  try {
    nodes.source.disconnect();
    nodes.gain.disconnect();
    nodes.panner.disconnect();
    nodes.stream.getTracks().forEach((t) => t.stop());
  } catch (e) {
    console.warn("Error disposing spatial node:", e);
  }
}

// --- Smooth update of a spatial node ---
// dt: time in seconds since last update (for smoothing)
export function applySpatialMix(
  nodes: SpatialAudioNodes,
  targetGain: number,
  targetPan: number,
  dt: number,
): void {
  // Smooth gain transition (tau ≈ 0.08s)
  const currentGain = nodes.gain.gain.value;
  const smoothFactor = 1 - Math.exp(-dt / 0.08);
  nodes.gain.gain.value = currentGain + (targetGain - currentGain) * smoothFactor;

  // Apply pan immediately (panning doesn't benefit from smoothing)
  nodes.panner.pan.value = targetPan;
}