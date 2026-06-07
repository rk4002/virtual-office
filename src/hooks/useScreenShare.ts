"use client";

// VirtualOffice — screen sharing hook
// Manages getDisplayMedia, publishing screen tracks to LiveKit,
// and subscribing to remote screen share tracks from other participants.
//
// Architecture:
//   - Uses LiveKit's setScreenShareEnabled() for local sharing (handles
//     getDisplayMedia + track publication automatically).
//   - Remote screen share tracks are detected via `track.source ===
//     Track.Source.ScreenShare` in TrackSubscribed events.
//   - Shared screens are rendered as <video> elements in ScreenShareViewer.
//
// Design decisions:
//   - One sharer at a time per room (user-facing UX; technically multiple
//     simultaneous shares work but the UI renders one per meeting room).
//   - Audio is NOT captured from screen shares (audio: false in capture options).
//   - The hook takes a Room ref from useLiveKitRoom so it plugs into the
//     existing connection lifecycle.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteVideoTrack,
  Track,
} from "livekit-client";

// --- Types ---

export interface ScreenShare {
  identity: string;
  name: string;
  track: MediaStreamTrack;
  isLocal: boolean;
}

export interface UseScreenShareReturn {
  isSharing: boolean;
  shares: Map<string, ScreenShare>;
  startShare: (sourceName?: string) => Promise<void>;
  stopShare: () => Promise<void>;
  error: string | null;
}

// --- Hook ---

export function useScreenShare(
  roomRef: React.RefObject<Room | null>,
  identity: string,
): UseScreenShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [shares, setShares] = useState<Map<string, ScreenShare>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const remoteVideoRef = useRef<Map<string, RemoteVideoTrack>>(new Map());
  // Track the stop handler callback for the ended event listener
  const stopHandlerRef = useRef<(() => void) | null>(null);

  // ── Start screen sharing ────────────────────────────────────────────────

  const startShare = useCallback(
    async (sourceName?: string) => {
      const room = roomRef.current;
      if (!room || room.state !== "connected") {
        setError("Ikke forbundet til LiveKit");
        return;
      }

      setError(null);

      try {
        // Use LiveKit's high-level setScreenShareEnabled API.
        // This calls getDisplayMedia internally, creates the track,
        // and publishes it with source=Track.Source.ScreenShare.
        const publication = await room.localParticipant.setScreenShareEnabled(
          true,
          {
            audio: false, // no system audio — mic is separate
            video: {
              // @ts-expect-error — cursor is a valid constraint but TS types lag
              cursor: "always",
            },
          },
        );

        if (!publication?.videoTrack?.mediaStreamTrack) {
          throw new Error("Ingen video-track fra skærmdeling");
        }

        setIsSharing(true);

        // Add local share to the shares map
        const videoTrack = publication.videoTrack.mediaStreamTrack;
        setShares((prev) => {
          const next = new Map(prev);
          next.set(identity, {
            identity,
            name: sourceName || `${identity}s skærm`,
            track: videoTrack,
            isLocal: true,
          });
          return next;
        });

        // Listen for user stopping share via browser UI ("Stop sharing" button)
        videoTrack.addEventListener("ended", () => {
          stopHandlerRef.current?.();
        });
      } catch (err) {
        // User cancelled the share dialog — not an error
        if (
          err instanceof DOMException &&
          (err.name === "AbortError" || err.name === "NotAllowedError")
        ) {
          return;
        }
        const msg = err instanceof Error ? err.message : "Kunne ikke starte skærmdeling";
        setError(msg);
        setIsSharing(false);
      }
    },
    [identity, roomRef],
  );

  // ── Stop screen sharing ─────────────────────────────────────────────────

  const stopShareInternal = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      // setScreenShareEnabled(false) unpublishes + stops the screen track
      room.localParticipant.setScreenShareEnabled(false).catch(() => {
        // ignore cleanup errors
      });
    }
    setIsSharing(false);

    setShares((prev) => {
      const next = new Map(prev);
      next.delete(identity);
      return next;
    });
  }, [identity, roomRef]);

  // Keep the ref in sync so 'ended' event listeners can call it
  stopHandlerRef.current = stopShareInternal;

  const stopShare = useCallback(async () => {
    stopShareInternal();
  }, [stopShareInternal]);

  // ── Remote screen share subscriptions ───────────────────────────────────

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    const handleTrackSubscribed = (
      track: RemoteTrack,
      _publication: unknown,
      participant: { identity: string; name?: string },
    ) => {
      if (
        track.kind === Track.Kind.Video &&
        track instanceof RemoteVideoTrack &&
        track.mediaStreamTrack &&
        track.source === Track.Source.ScreenShare
      ) {
        remoteVideoRef.current.set(participant.identity, track);

        setShares((prev) => {
          const next = new Map(prev);
          next.set(participant.identity, {
            identity: participant.identity,
            name: participant.name || participant.identity,
            track: track.mediaStreamTrack!,
            isLocal: false,
          });
          return next;
        });

        // Clean up when the track ends
        track.mediaStreamTrack!.addEventListener("ended", () => {
          remoteVideoRef.current.delete(participant.identity);
          setShares((prev) => {
            const next = new Map(prev);
            next.delete(participant.identity);
            return next;
          });
        });
      }
    };

    const handleTrackUnsubscribed = (
      track: RemoteTrack,
      _publication: unknown,
      participant: { identity: string },
    ) => {
      if (track.kind === Track.Kind.Video) {
        remoteVideoRef.current.delete(participant.identity);
        setShares((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
      }
    };

    const handleParticipantDisconnected = (participant: { identity: string }) => {
      remoteVideoRef.current.delete(participant.identity);
      setShares((prev) => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [roomRef]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Stop local share if active
      const room = roomRef.current;
      if (room) {
        room.localParticipant.setScreenShareEnabled(false).catch(() => {});
      }
      for (const [, track] of remoteVideoRef.current) {
        track.stop();
      }
      remoteVideoRef.current.clear();
    };
  }, [roomRef]);

  return {
    isSharing,
    shares,
    startShare,
    stopShare,
    error,
  };
}