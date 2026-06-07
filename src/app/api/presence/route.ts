// VirtualOffice — Presence API via SSE
// POST /api/presence  — heartbeat (update position, keep alive)
// GET  /api/presence  — SSE stream of online users
//
// Independent of LiveKit — uses Vercel Postgres for state.

import { NextRequest, NextResponse } from "next/server";
import {
  initPresenceSchema,
  heartbeatPresence,
  getOnlineUsers,
  markOffline,
} from "@/lib/db";

// ── POST /api/presence — heartbeat ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await initPresenceSchema();

    const body = await req.json();
    const { userId, name, email, x, y } = body;

    if (!userId || !name || !email) {
      return NextResponse.json(
        { error: "userId, name, and email are required" },
        { status: 400 },
      );
    }

    const px = typeof x === "number" ? x : 0;
    const py = typeof y === "number" ? y : 0;

    await heartbeatPresence(
      String(userId).slice(0, 128),
      String(name).slice(0, 256),
      String(email).slice(0, 256),
      px,
      py,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/presence error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

// ── GET /api/presence — SSE stream ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await initPresenceSchema();
  } catch (err) {
    console.error("GET /api/presence init error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }

  // Vercel Edge / serverless: SSE with manual polling via TextEncoder stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const POLL_MS = 2_000; // poll every 2 seconds
      let lastPayload = "";

      const enqueueSSE = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      // Send initial state
      try {
        const users = await getOnlineUsers();
        const payload = JSON.stringify(users);
        lastPayload = payload;
        enqueueSSE("presence", payload);
      } catch (err) {
        console.error("Initial presence fetch error:", err);
        enqueueSSE("presence", "[]");
      }

      // Poll loop
      const interval = setInterval(async () => {
        try {
          const users = await getOnlineUsers();
          const payload = JSON.stringify(users);
          if (payload !== lastPayload) {
            lastPayload = payload;
            enqueueSSE("presence", payload);
          } else {
            // Send keepalive (empty comment) so the connection doesn't time out
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch (err) {
          console.error("Presence poll error:", err);
          // Don't break the stream on transient errors
        }
      }, POLL_MS);

      // Cleanup on disconnect
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
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}