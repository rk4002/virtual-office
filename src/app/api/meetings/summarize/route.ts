// VirtualOffice — AI-genereret møde-opsummering (POST)
//
// POST /api/meetings/summarize
//   Body: { room_id, room_name, user_id, user_name, messages: ChatMessage[] }
//   Sender chat-beskeder til en LLM (OpenAI-kompatibel API) og gemmer det genererede resumé.
//
// Miljøvariable:
//   LLM_API_URL  — base URL (default: https://api.openai.com/v1)
//   LLM_API_KEY  — API key
//   LLM_MODEL    — model navn (default: gpt-4o-mini)

import { NextRequest, NextResponse } from "next/server";
import {
  initMeetingSummariesSchema,
  saveMeetingSummary,
  getMeetingSummaries,
} from "@/lib/db";
import type { ChatMessage } from "@/lib/db";

const LLM_API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// ── Helpers ───────────────────────────────────────────────────────────────

function buildPrompt(messages: { sender_name: string; text: string }[]): string {
  const conversation = messages
    .map((m) => `${m.sender_name}: ${m.text}`)
    .join("\n");

  return `Du er en mødeassistent der laver danske møde-opsummeringer. 
Analysér den følgende chat-samtale og generér et struktureret resumé på dansk.

Inkludér:
1. **Deltagere** — hvem var med (udled fra afsendernavne)
2. **Hovedemner** — hvad blev der talt om (2-5 emner som punktopstilling)
3. **Beslutninger** — hvilke konkrete beslutninger blev truffet (hvis nogen)
4. **Action points** — hvem skal gøre hvad (hvis nævnt)
5. **Næste skridt** — hvad er det næste der skal ske

Hvis noget er uklart eller mangler, så skriv "Ikke nævnt i samtalen" i stedet for at gætte.

Her er chat-samtalen:

${conversation}`;
}

// ── GET /api/meetings/summarize?room_id=<id>[&limit=5] ─────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const roomId = url.searchParams.get("room_id");
    const limitParam = url.searchParams.get("limit");

    if (!roomId) {
      return NextResponse.json(
        { error: "room_id query parameter is required" },
        { status: 400 },
      );
    }

    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 5, 1), 20) : 5;

    await initMeetingSummariesSchema();
    const summaries = await getMeetingSummaries(roomId, limit);

    return NextResponse.json({ ok: true, summaries });
  } catch (err) {
    console.error("GET /api/meetings/summarize error:", err);
    return NextResponse.json(
      { error: "Intern serverfejl" },
      { status: 500 },
    );
  }
}

// ── POST /api/meetings/summarize ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room_id, room_name, user_id, user_name, messages } = body as {
      room_id: string;
      room_name: string;
      user_id: string;
      user_name: string;
      messages: { sender_name: string; text: string }[];
    };

    if (!room_id || !room_name || !user_id || !user_name) {
      return NextResponse.json(
        { error: "room_id, room_name, user_id, and user_name are required" },
        { status: 400 },
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Ingen beskeder at opsummere — chatten er tom" },
        { status: 400 },
      );
    }

    if (!LLM_API_KEY) {
      return NextResponse.json(
        { error: "LLM_API_KEY ikke konfigureret — sæt den i .env.local" },
        { status: 500 },
      );
    }

    // Build prompt
    const prompt = buildPrompt(messages);

    // Call LLM
    const llmResponse = await fetch(`${LLM_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error("LLM API error:", llmResponse.status, errorText);
      return NextResponse.json(
        { error: `Kunne ikke kontakte LLM: ${llmResponse.status}` },
        { status: 502 },
      );
    }

    const llmData = await llmResponse.json();
    const summaryText: string =
      llmData.choices?.[0]?.message?.content?.trim() || "";

    if (!summaryText) {
      return NextResponse.json(
        { error: "LLM returnerede et tomt svar" },
        { status: 500 },
      );
    }

    // Save to DB
    await initMeetingSummariesSchema();
    const saved = await saveMeetingSummary({
      room_id: room_id.toString().slice(0, 128),
      room_name: room_name.toString().slice(0, 256),
      requested_by: user_id.toString().slice(0, 128),
      requested_by_name: user_name.toString().slice(0, 128),
      summary: summaryText,
      message_count: messages.length,
    });

    return NextResponse.json({ ok: true, summary: saved });
  } catch (err) {
    console.error("POST /api/meetings/summarize error:", err);
    return NextResponse.json(
      { error: "Intern serverfejl" },
      { status: 500 },
    );
  }
}