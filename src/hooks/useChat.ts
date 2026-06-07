"use client";

// VirtualOffice — Chat hooks
// useChat: subscribes to /api/chat SSE stream + send function
// useChatUnread: tracks unread count for notification dots
//
// Independent of LiveKit — works alongside or without it.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatScope } from "@/lib/db";

export type { ChatMessage, ChatScope };

// ── useChat — SSE subscription + send ─────────────────────────────────────

export interface UseChatOptions {
  /** Filter to a specific room (room messages) */
  roomId?: string;
  /** Filter to private messages with this user */
  dmWith?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const { roomId, dmWith } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      if (es) {
        es.close();
        es = null;
      }

      // Build URL with filters
      const params = new URLSearchParams();
      if (roomId) params.set("room", roomId);
      if (dmWith) params.set("dm", dmWith);
      const url = `/api/chat${params.toString() ? "?" + params.toString() : ""}`;

      es = new EventSource(url);

      es.addEventListener("chat", (event) => {
        try {
          const data: ChatMessage[] = JSON.parse(event.data);
          if (mounted) {
            setMessages(data);
            if (data.length > 0) {
              setLastMessage(data[data.length - 1]);
            }
          }
        } catch {
          // ignore malformed payloads
        }
      });

      es.addEventListener("error", () => {
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
  }, [roomId, dmWith]);

  // ── send ────────────────────────────────────────────────────────────────

  const send = useCallback(
    async (params: {
      scope: ChatScope;
      recipientId?: string;
      text: string;
      senderId: string;
      senderName: string;
      x: number;
      y: number;
    }) => {
      const body: Record<string, unknown> = {
        scope: params.scope,
        sender_id: params.senderId,
        sender_name: params.senderName,
        text: params.text,
        x: params.x,
        y: params.y,
      };

      if (params.scope === "room") {
        body.room_id = roomId;
      } else {
        body.recipient_id = params.recipientId ?? dmWith;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to send message");
      }

      return res.json();
    },
    [roomId, dmWith],
  );

  return { messages, lastMessage, send };
}

// ── useChatUnread — track unread count per room/global ────────────────────

export function useChatUnread(currentUserId: string) {
  const [unread, setUnread] = useState<Map<string, number>>(new Map());
  const lastSeenRef = useRef<Map<string, string>>(new Map()); // room_id → last_seen id

  const markRead = useCallback((roomId: string) => {
    const key = roomId || "__global__";
    setUnread((prev) => {
      const next = new Map(prev);
      next.set(key, 0);
      return next;
    });
  }, []);

  const trackMessage = useCallback(
    (msg: ChatMessage, activeRoomId: string | null) => {
      if (msg.sender_id === currentUserId) return;

      const msgRoom = msg.room_id || "__global__";
      if (activeRoomId === msgRoom || (activeRoomId === null && msg.scope === "room")) {
        return; // user is currently viewing this room
      }

      setUnread((prev) => {
        const next = new Map(prev);
        const count = next.get(msgRoom) || 0;
        next.set(msgRoom, count + 1);
        return next;
      });
    },
    [currentUserId],
  );

  return { unread, markRead, trackMessage };
}