"use client";

// VirtualOffice — Presence hooks
// usePresence: subscribes to the /api/presence SSE stream
// useHeartbeat: POSTs heartbeat to /api/presence on an interval
//
// Independent of LiveKit — works alongside or without it.

import { useCallback, useEffect, useRef, useState } from "react";
import type { PresenceUser } from "@/lib/db";

export type { PresenceUser };

// ── usePresence — SSE subscription ────────────────────────────────────────

export function usePresence(): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const usersRef = useRef<PresenceUser[]>([]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      // Close any existing connection
      if (es) {
        es.close();
        es = null;
      }

      es = new EventSource("/api/presence");

      es.addEventListener("presence", (event) => {
        try {
          const data: PresenceUser[] = JSON.parse(event.data);
          if (mounted) {
            usersRef.current = data;
            setUsers(data);
          }
        } catch {
          // ignore malformed payloads
        }
      });

      es.addEventListener("error", () => {
        // EventSource auto-reconnects, but add a fallback timer
        es?.close();
        es = null;
        if (mounted) {
          reconnectTimer = setTimeout(connect, 3_000);
        }
      });
    }

    connect();

    return () => {
      mounted = false;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return users;
}

// ── useHeartbeat — posts position + identity to /api/presence ─────────────

export function useHeartbeat(
  userId: string,
  name: string,
  email: string,
  x: number,
  y: number,
  intervalMs: number = 4_000,
) {
  const lastX = useRef(x);
  const lastY = useRef(y);
  lastX.current = x;
  lastY.current = y;

  const userIdRef = useRef(userId);
  const nameRef = useRef(name);
  const emailRef = useRef(email);
  userIdRef.current = userId;
  nameRef.current = name;
  emailRef.current = email;

  useEffect(() => {
    if (!userId || !name || !email) return;

    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendHeartbeat = () => {
      if (!mounted) return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdRef.current,
          name: nameRef.current,
          email: emailRef.current,
          x: lastX.current,
          y: lastY.current,
        }),
      }).catch(() => {
        // silently ignore network errors — we'll retry next tick
      });
    };

    // Send immediately, then on interval
    sendHeartbeat();
    timer = setInterval(sendHeartbeat, intervalMs);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [userId, name, email, intervalMs]);
}

// ── Helper: generate stable userId from name ──────────────────────────────

export function deriveUserId(name: string): string {
  if (!name) return "";
  // Simple hash of name to produce a stable userId
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const chr = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // convert to 32bit integer
  }
  return `user-${Math.abs(hash).toString(16).slice(0, 8)}`;
}