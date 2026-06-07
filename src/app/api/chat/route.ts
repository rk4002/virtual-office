// VirtualOffice — Chat API via SSE
// POST /api/chat  — send a message
// GET  /api/chat  — SSE stream of active chat messages
//
// Supports room messages and private DMs.
// Independent of LiveKit — uses Vercel Postgres for state.
//
// Query params:
//   ?room=<room_id>       — filter to room messages for that room
//   ?dm=<recipient_id>    — filter to private messages with that user
//   (combine both to scope to a specific DM within a specific room — DM ignores room)

import { NextRequest, NextResponse } from "next/server";
import {
  initChatSchema,
  insertChatMessage,
  getChatMessages,
  purgeExpiredMessages,
} from "@/lib/db";

// ── POST /api/chat — send a message ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await initChatSchema();

    const body = await req.json();
    const {
      scope,         // "room" | "private"
      room_id,       // null for private
      sender_id,
      sender_name,
      recipient_id,  // null for room
      text,
      x,
      y,
    } = body;

    if (!scope || !sender_id || !sender_name || !text) {
      return NextResponse.json(
        { error: "scope, sender_id, sender_name, and text are required" },
        { status: 400 },
      );
    }

    if (scope !== "room" && scope !== "private") {
      return NextResponse.json(
        { error: 'scope must be "room" or "private"' },
        { status: 400 },
      );
    }

    if (scope === "room" && !room_id) {
      return NextResponse.json(
        { error: 'room_id is required for room scope' },
        { status: 400 },
      );
    }

    if (scope === "private" && !recipient_id) {
      return NextResponse.json(
        { error: 'recipient_id is required for private scope' },
        { status: 400 },
      );
    }

    // Sanitize: trim + length limit
    const sanitizedText = String(text).trim().slice(0, 500);
    if (!sanitizedText) {
      return NextResponse.json(
        { error: "text must not be empty" },
        { status: 400 },
      );
    }

    const message = await insertChatMessage({
      scope,
      room_id: scope === "room" ? String(room_id) : null,
      sender_id: String(sender_id).slice(0, 128),
      sender_name: String(sender_name).slice(0, 128),
      recipient_id: scope === "private" ? String(recipient_id).slice(0, 128) : null,
      text: sanitizedText,
      x: typeof x === "number" ? x : 0,
      y: typeof y === "number" ? y : 0,
    });

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error("POST /api/chat error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

// ── GET /api/chat — SSE stream ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await initChatSchema();
  } catch (err) {
    console.error("GET /api/chat init error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }

  const url = new URL(req.url);
  const roomId = url.searchParams.get("room") || undefined;
  const dmWith = url.searchParams.get("dm") || undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const POLL_MS = 1_500;
      let lastPayload = "";
      let purgeCounter = 0;

      const enqueueSSE = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      // Initial fetch
      try {
        const messages = dmWith
          ? await getChatMessages({
              participants: [dmWith, dmWith], // sender will be filled server-side
            })
          : await getChatMessages(roomId ? { room_id: roomId } : undefined);

        const payload = JSON.stringify(messages);
        lastPayload = payload;
        enqueueSSE("chat", payload);
      } catch (err) {
        console.error("Initial chat fetch error:", err);
        enqueueSSE("chat", "[]");
      }

      // Poll loop
      const interval = setInterval(async () => {
        try {
          // Purge expired messages every ~30s
          purgeCounter++;
          if (purgeCounter % 20 === 0) {
            await purgeExpiredMessages();
          }

          const messages = dmWith
            ? await getChatMessages({
                participants: [dmWith, dmWith],
              })
            : await getChatMessages(roomId ? { room_id: roomId } : undefined);

          const payload = JSON.stringify(messages);
          if (payload !== lastPayload) {
            lastPayload = payload;
            enqueueSSE("chat", payload);
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch (err) {
          console.error("Chat poll error:", err);
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}