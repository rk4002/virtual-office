// VirtualOffice — Office Layout CRUD API
// Next.js 15 Route Handler: /api/layouts

import { NextRequest, NextResponse } from "next/server";
import {
  initSchema,
  getAllLayouts,
  getLayout,
  createLayout,
  updateLayout,
  deleteLayout,
} from "@/lib/db";

// ── GET /api/layouts — list all, or ?id=... for one ──────────────────────

export async function GET(req: NextRequest) {
  try {
    await initSchema();

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const layout = await getLayout(id);
      if (!layout) {
        return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
      }
      return NextResponse.json(layout);
    }

    const layouts = await getAllLayouts();
    return NextResponse.json(layouts);
  } catch (err) {
    console.error("GET /api/layouts error:", err);
    return NextResponse.json(
      { error: "Database fejl" },
      { status: 500 },
    );
  }
}

// ── POST /api/layouts — create a new layout ──────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await initSchema();

    const body = await req.json();
    const { name, floor_width, floor_height, rooms } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Navn kraeves" },
        { status: 400 },
      );
    }

    const layout = await createLayout(
      name,
      floor_width ?? 2400,
      floor_height ?? 1350,
      rooms ?? [],
    );

    return NextResponse.json(layout, { status: 201 });
  } catch (err) {
    console.error("POST /api/layouts error:", err);
    return NextResponse.json(
      { error: "Database fejl" },
      { status: 500 },
    );
  }
}

// ── PUT /api/layouts?id=... — update a layout ────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    await initSchema();

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Mangler id parameter" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const updated = await updateLayout(id, body);

    if (!updated) {
      return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/layouts error:", err);
    return NextResponse.json(
      { error: "Database fejl" },
      { status: 500 },
    );
  }
}

// ── DELETE /api/layouts?id=... — delete a layout ─────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    await initSchema();

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Mangler id parameter" },
        { status: 400 },
      );
    }

    const deleted = await deleteLayout(id);
    if (!deleted) {
      return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/layouts error:", err);
    return NextResponse.json(
      { error: "Database fejl" },
      { status: 500 },
    );
  }
}