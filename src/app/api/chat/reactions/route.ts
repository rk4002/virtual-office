// VirtualOffice — Chat Reactions API
// POST /api/chat/reactions       — toggle a reaction on a message
// GET  /api/chat/reactions?ids=  — fetch reactions for one or more messages
//
// Emoji reactions work alongside the existing chat system.
// Each user can add/remove one emoji per message. The emoji, user triple
// is unique-constrained at the DB level (chat_reactions table).

import { NextRequest, NextResponse } from "next/server";
import {
  initChatReactionsSchema,
  toggleReaction,
  getReactionsForMessages,
} from "@/lib/db";

// ── POST /api/chat/reactions — toggle a reaction ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await initChatReactionsSchema();

    const body = await req.json();
    const { message_id, emoji, user_id, user_name } = body;

    if (!message_id || !emoji || !user_id || !user_name) {
      return NextResponse.json(
        { error: "message_id, emoji, user_id, and user_name are required" },
        { status: 400 },
      );
    }

    // Sanitize
    const sanitizedEmoji = String(emoji).slice(0, 64).trim();
    const sanitizedMessageId = String(message_id).slice(0, 128);
    const sanitizedUserId = String(user_id).slice(0, 128);
    const sanitizedUserName = String(user_name).slice(0, 128);

    if (!sanitizedEmoji) {
      return NextResponse.json(
        { error: "emoji must not be empty" },
        { status: 400 },
      );
    }

    const result = await toggleReaction({
      message_id: sanitizedMessageId,
      emoji: sanitizedEmoji,
      user_id: sanitizedUserId,
      user_name: sanitizedUserName,
    });

    return NextResponse.json({
      ok: true,
      action: result.action,
      reactions: result.reactions,
    });
  } catch (err) {
    console.error("POST /api/chat/reactions error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}

// ── GET /api/chat/reactions — fetch reactions ────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await initChatReactionsSchema();

    const url = new URL(req.url);
    const idsParam = url.searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "ids query parameter is required (comma-separated message IDs)" },
        { status: 400 },
      );
    }

    const messageIds = idsParam
      .split(",")
      .map((id) => id.trim().slice(0, 128))
      .filter(Boolean);

    if (messageIds.length === 0) {
      return NextResponse.json({ ok: true, reactions: {} });
    }

    if (messageIds.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 message IDs per request" },
        { status: 400 },
      );
    }

    const reactionsMap = await getReactionsForMessages(messageIds);

    // Convert Map to plain object for JSON
    const reactions: Record<string, unknown> = {};
    for (const [msgId, aggregated] of reactionsMap) {
      reactions[msgId] = aggregated;
    }

    return NextResponse.json({ ok: true, reactions });
  } catch (err) {
    console.error("GET /api/chat/reactions error:", err);
    return NextResponse.json({ error: "Database fejl" }, { status: 500 });
  }
}