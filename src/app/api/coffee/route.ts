// VirtualOffice — Virtual Coffee Machine API
// POST /api/coffee  — request today's coffee match (or return existing)
// GET  /api/coffee  — get today's coffee match for the current user
//
// Én match per bruger per dag (matched_at >= midnight UTC).
// Hvis to brugere matcher hinanden → mutual (begge ser hinanden som match).

import { NextRequest, NextResponse } from "next/server";
import {
  initCoffeeMatchesSchema,
  createCoffeeMatch,
  getTodayCoffeeMatch,
  getOnlineUsers,
} from "@/lib/db";

// ── POST /api/coffee — request a match ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await initCoffeeMatchesSchema();

    const body = await req.json();
    const { user_id, user_name } = body;

    if (!user_id || !user_name) {
      return NextResponse.json(
        { error: "user_id and user_name are required" },
        { status: 400 },
      );
    }

    const uid = String(user_id).slice(0, 128);
    const uname = String(user_name).slice(0, 256);

    // Check for existing today-match first (idempotent)
    const existing = await getTodayCoffeeMatch(uid);
    if (existing) {
      return NextResponse.json({ ok: true, match: existing });
    }

    // Get online users as candidates
    const online = await getOnlineUsers();
    const candidates = online.map((u) => ({
      user_id: u.user_id,
      name: u.name,
    }));

    const match = await createCoffeeMatch(uid, uname, candidates);

    return NextResponse.json({ ok: true, match });
  } catch (err) {
    // "Ingen online kollegaer" is a normal case — return a friendly response
    const message = err instanceof Error ? err.message : "Database fejl";
    if (message === "Ingen online kollegaer at matche med") {
      return NextResponse.json(
        { ok: false, error: message, match: null },
        { status: 200 },
      );
    }
    console.error("POST /api/coffee error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

// ── GET /api/coffee — fetch today's match ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await initCoffeeMatchesSchema();

    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "user_id query parameter is required" },
        { status: 400 },
      );
    }

    const uid = String(userId).slice(0, 128);
    const match = await getTodayCoffeeMatch(uid);

    return NextResponse.json({ ok: true, match });
  } catch (err) {
    console.error("GET /api/coffee error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}