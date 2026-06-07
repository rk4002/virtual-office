"use client";

// VirtualOffice — LiveKit room + spatial audio hook
// Manages LiveKit connection lifecycle, microphone, peer tracking,
// position broadcast/receive via data channel, and spatial audio rendering.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  RemoteTrack,
  RemoteParticipant,
  Track,
} from "livekit-client";
import {
  ensureAudioContext,
  closeAudioContext,
  createSpatialNode,
  disposeSpatialNode,
  applySpatialMix,
  computeSpatialMix,
  SpatialAudioNodes,
} from "@/lib/spatial-audio-engine";
import {
  POSITION_SYNC_HZ,
  INTERP_RATE,
  MOVE_SPEED,
  FLOOR_W,
  FLOOR_H,
  SPAWN,
  randomPeerColor,
  Entity,
  PlayerState,
} from "@/lib/office-layout";

// --- Types ---
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type { PlayerState } from "@/lib/office-layout";

export interface LiveKitPeer {
  identity: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
}

interface PositionMessage {
  type: "position";
  x: number;
  y: number;
  timestamp: number;
}

export interface UseLiveKitRoomReturn {
  status: ConnectionStatus;
  error: string | null;
  connect: (roomName: string, participantName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  micEnabled: boolean;
  toggleMic: () => Promise<void>;
  peers: Map<string, LiveKitPeer>;
  player: PlayerState;
  setPlayerTarget: (x: number, y: number) => void;
  movePlayer: (dx: number, dy: number, dt: number) => void;
  roomRef: React.RefObject<Room | null>;
}

// --- Hook ---
export function useLiveKitRoom(): UseLiveKitRoomReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [peers, setPeers] = useState<Map<string, LiveKitPeer>>(new Map());

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const peerAudioNodesRef = useRef<Map<string, SpatialAudioNodes>>(new Map());
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRafRef = useRef<number | null>(null);
  const playerRef = useRef<PlayerState>({
    id: "",
    name: "",
    x: SPAWN.x,
    y: SPAWN.y,
    targetX: SPAWN.x,
    targetY: SPAWN.y,
  });
  const [player, setPlayer] = useState<PlayerState>(playerRef.current);
  const keysRef = useRef<Set<string>>(new Set());
  const lastTickRef = useRef<number>(0);
  // Synchronous peer position mirror for spatial audio in RAF loop
  const peerPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // --- Connection ---
  const connect = useCallback(async (roomName: string, participantName: string) => {
    setStatus("connecting");
    setError(null);

    try {
      // 1. Get token from our API
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get token");
      }

      const { token, serverUrl } = await res.json();

      // 2. Create and configure LiveKit room
      // Spatial audio for Danish office environments:
      // - Opus codec at 32 kbps (speech-optimized, sufficient for spatial audio)
      // - adaptiveStream + dynacast for bandwidth adaptation under poor conditions
      // - stopLocalTrackOnUnpublish: clean up mic when un-publishing
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1, // mono — spatial audio handles panning
        },
        audioOutput: {
          // Default LiveKit publish bitrate; the spatial engine applies per-peer gain
        },
      });

      // --- Track subscriptions ---
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
        if (track.kind === Track.Kind.Audio && track.mediaStreamTrack) {
          const nodes = createSpatialNode(track.mediaStreamTrack);
          if (nodes) {
            peerAudioNodesRef.current.set(participant.identity, nodes);
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const nodes = peerAudioNodesRef.current.get(participant.identity);
          if (nodes) {
            disposeSpatialNode(nodes);
            peerAudioNodesRef.current.delete(participant.identity);
          }
        }
      });

      // --- Participant lifecycle ---
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setPeers((prev) => {
          const next = new Map(prev);
          if (!next.has(participant.identity)) {
            next.set(participant.identity, {
              identity: participant.identity,
              name: participant.name || participant.identity,
              x: SPAWN.x + Math.random() * 200 - 100,
              y: SPAWN.y + Math.random() * 200 - 100,
              targetX: SPAWN.x,
              targetY: SPAWN.y,
              color: randomPeerColor(),
            });
          }
          return next;
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
        const nodes = peerAudioNodesRef.current.get(participant.identity);
        if (nodes) {
          disposeSpatialNode(nodes);
          peerAudioNodesRef.current.delete(participant.identity);
        }
      });

      // --- Data channel: position sync ---
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
        if (!participant) return;
        try {
          const data: PositionMessage = JSON.parse(new TextDecoder().decode(payload));
          if (data.type === "position") {
            setPeers((prev) => {
              const next = new Map(prev);
              const peer = next.get(participant.identity);
              if (peer) {
                next.set(participant.identity, {
                  ...peer,
                  targetX: data.x,
                  targetY: data.y,
                });
              } else {
                // New peer from data — add with defaults
                next.set(participant.identity, {
                  identity: participant.identity,
                  name: participant.name || participant.identity,
                  x: data.x,
                  y: data.y,
                  targetX: data.x,
                  targetY: data.y,
                  color: randomPeerColor(),
                });
              }
              return next;
            });
          }
        } catch {
          // ignore non-JSON / non-position messages
        }
      });

      // 3. Connect to LiveKit
      await room.connect(serverUrl, token);
      roomRef.current = room;

      // 4. Enable local mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const track = new LocalAudioTrack(audioTrack);
          await room.localParticipant.publishTrack(track);
          localTrackRef.current = track;
          setMicEnabled(true);
        }
      } catch (micErr) {
        console.warn("Microphone access denied:", micErr);
        setMicEnabled(false);
      }

      // 5. Start position broadcast
      const intervalMs = 1000 / POSITION_SYNC_HZ;
      broadcastIntervalRef.current = setInterval(() => {
        if (room.state !== "connected") return;
        const p = playerRef.current;
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: "position",
            x: p.x,
            y: p.y,
            timestamp: Date.now(),
          }),
        );
        room.localParticipant.publishData(payload, { reliable: false });
      }, intervalMs);

      // Update player identity
      playerRef.current = {
        ...playerRef.current,
        id: participantName,
        name: participantName,
      };
      setPlayer(playerRef.current);

      setStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      setStatus("error");
    }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(async () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }

    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Clean up all peer audio nodes
    for (const [, nodes] of peerAudioNodesRef.current) {
      disposeSpatialNode(nodes);
    }
    peerAudioNodesRef.current.clear();

    await closeAudioContext();

    setPeers(new Map());
    setMicEnabled(false);
    setStatus("disconnected");
    setError(null);
  }, []);

  // --- Toggle mic ---
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;

    if (micEnabled) {
      if (localTrackRef.current) {
        room.localParticipant.unpublishTrack(localTrackRef.current);
        localTrackRef.current.stop();
        localTrackRef.current = null;
      }
      setMicEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const track = new LocalAudioTrack(audioTrack);
          await room.localParticipant.publishTrack(track);
          localTrackRef.current = track;
          setMicEnabled(true);
        }
      } catch (err) {
        console.error("Failed to enable mic:", err);
      }
    }
  }, [micEnabled]);

  // --- Player movement ---
  const setPlayerTarget = useCallback((x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(FLOOR_W, x));
    const clampedY = Math.max(0, Math.min(FLOOR_H, y));
    playerRef.current = {
      ...playerRef.current,
      targetX: clampedX,
      targetY: clampedY,
    };
    setPlayer(playerRef.current);
  }, []);

  const movePlayer = useCallback((dx: number, dy: number, dt: number) => {
    const p = playerRef.current;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const ndx = (dx / len) * MOVE_SPEED * dt;
    const ndy = (dy / len) * MOVE_SPEED * dt;
    const newX = Math.max(0, Math.min(FLOOR_W, p.x + ndx));
    const newY = Math.max(0, Math.min(FLOOR_H, p.y + ndy));
    playerRef.current = {
      ...p,
      x: newX,
      y: newY,
      targetX: newX,
      targetY: newY,
    };
    setPlayer(playerRef.current);
  }, []);

  // --- Game loop: peer interpolation + spatial audio ---
  useEffect(() => {
    if (status !== "connected") return;

    lastTickRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.1);
      lastTickRef.current = now;

      // 1. Player click-to-move lerp
      const p = playerRef.current;
      if (p.targetX !== p.x || p.targetY !== p.y) {
        const tdx = p.targetX - p.x;
        const tdy = p.targetY - p.y;
        const td = Math.sqrt(tdx * tdx + tdy * tdy);
        const speed = MOVE_SPEED * dt;
        if (td <= speed) {
          playerRef.current = { ...p, x: p.targetX, y: p.targetY };
        } else {
          playerRef.current = {
            ...p,
            x: p.x + (tdx / td) * speed,
            y: p.y + (tdy / td) * speed,
          };
        }
      }

      // Also handle WASD movement from keysRef
      let wdx = 0,
        wdy = 0;
      const keys = keysRef.current;
      if (keys.has("KeyW") || keys.has("ArrowUp")) wdy -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) wdy += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) wdx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) wdx += 1;
      if (wdx !== 0 || wdy !== 0) {
        const q = playerRef.current;
        const len = Math.sqrt(wdx * wdx + wdy * wdy);
        const ndx = (wdx / len) * MOVE_SPEED * dt;
        const ndy = (wdy / len) * MOVE_SPEED * dt;
        const nx = Math.max(0, Math.min(FLOOR_W, q.x + ndx));
        const ny = Math.max(0, Math.min(FLOOR_H, q.y + ndy));
        playerRef.current = { ...q, x: nx, y: ny, targetX: nx, targetY: ny };
      }

      // 2. Peer interpolation (lerp)
      setPeers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, peer] of next) {
          const px = peer.x + (peer.targetX - peer.x) * INTERP_RATE;
          const py = peer.y + (peer.targetY - peer.y) * INTERP_RATE;
          if (Math.abs(px - peer.x) > 0.01 || Math.abs(py - peer.y) > 0.01) {
            next.set(id, { ...peer, x: px, y: py });
            changed = true;
          }
        }
        // Sync peer position ref for spatial audio (synchronous, no re-render)
        const posMap = new Map<string, { x: number; y: number }>();
        for (const [id, peer] of next) {
          posMap.set(id, { x: peer.x, y: peer.y });
        }
        peerPosRef.current = posMap;
        return changed ? next : prev;
      });

      // 3. Spatial audio update
      const playerPos = playerRef.current;
      const peerPosMap = peerPosRef.current;
      if (peerPosMap.size > 0) {
        const mixResults = computeSpatialMix(playerPos, peerPosMap);
        for (const result of mixResults) {
          const nodes = peerAudioNodesRef.current.get(result.peerId);
          if (nodes) {
            applySpatialMix(nodes, result.gain, result.pan, dt);
          }
        }

        // Mute peers not in results
        const resultIds = new Set(mixResults.map((r) => r.peerId));
        for (const [peerId, nodes] of peerAudioNodesRef.current) {
          if (!resultIds.has(peerId)) {
            nodes.gain.gain.value = 0;
          }
        }
      }

      // 4. Update React state (throttled — only the player state matters for render)
      setPlayer({ ...playerRef.current });

      posRafRef.current = requestAnimationFrame(loop);
    };

    posRafRef.current = requestAnimationFrame(loop);

    return () => {
      if (posRafRef.current) cancelAnimationFrame(posRafRef.current);
    };
  }, [status, peers]);

  // --- Keyboard listener for WASD ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === "KeyF") {
        // Focus on player
        // (handled in OfficeCanvas)
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    error,
    connect,
    disconnect,
    micEnabled,
    toggleMic,
    peers,
    player,
    setPlayerTarget,
    movePlayer,
    roomRef,
  };
}