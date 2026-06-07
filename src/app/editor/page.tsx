"use client";

// VirtualOffice — Layout editor page
// Standalone page for designing office layouts (no LiveKit dependency).

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { LayoutRoom } from "@/lib/db";

const LazyLayoutEditor = dynamic(() => import("@/components/LayoutEditor"), {
  ssr: false,
});
import type { SavedLayout } from "@/components/LayoutEditor";

// ── Colour constants ────────────────────────────────────────────────────
const C = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
};

// ── Layout list item ────────────────────────────────────────────────────
interface LayoutListItem {
  id: string;
  name: string;
  floor_width: number;
  floor_height: number;
  rooms: LayoutRoom[];
  created_at: string;
  updated_at: string;
}

export default function EditorPage() {
  const [layoutList, setLayoutList] = useState<LayoutListItem[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [currentLayout, setCurrentLayout] = useState<SavedLayout | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [error, setError] = useState<string | null>(null);

  // Fetch layout list
  const fetchList = useCallback(async () => {
    try {
      const resp = await fetch("/api/layouts");
      if (resp.ok) {
        const data = await resp.json();
        setLayoutList(data);
      } else {
        // DB may not be available — that's OK for standalone testing
        setError("Kunne ikke hente layouts (DB utilgængelig?)");
      }
    } catch {
      setError("Kunne ikke forbinde til server.");
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Load a layout
  const handleLoad = useCallback(
    async (id: string) => {
      try {
        const resp = await fetch(`/api/layouts?id=${id}`);
        if (resp.ok) {
          const data = await resp.json();
          setCurrentLayout({
            id: data.id,
            name: data.name,
            floor_width: data.floor_width,
            floor_height: data.floor_height,
            rooms: data.rooms ?? [],
            placements: data.placements ?? [],
          });
          setSelectedLayoutId(id);
          setViewMode("editor");
        }
      } catch {
        setError("Kunne ikke loade layout.");
      }
    },
    [],
  );

  // Create new
  const handleNew = () => {
    setCurrentLayout(undefined);
    setSelectedLayoutId(null);
    setViewMode("editor");
  };

  // Delete a layout
  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på du vil slette dette layout?")) return;
    try {
      await fetch(`/api/layouts?id=${id}`, { method: "DELETE" });
      fetchList();
      if (selectedLayoutId === id) {
        setCurrentLayout(undefined);
        setSelectedLayoutId(null);
        setViewMode("list");
      }
    } catch {
      setError("Kunne ikke slette layout.");
    }
  };

  // Return to list after save
  const handleSaved = useCallback(() => {
    fetchList();
  }, [fetchList]);

  // ── Editor view ──
  if (viewMode === "editor") {
    return (
      <LazyLayoutEditor
        initialLayout={currentLayout}
        onSave={async () => {
          handleSaved();
        }}
      />
    );
  }

  // ── Layout list view ──
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-6"
      style={{ background: C.bg, color: C.text }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Layout Editor
        </h1>
        <p className="text-sm" style={{ color: C.textDim }}>
          Design dit virtuelle kontor
        </p>
      </div>

      <div
        className="flex flex-col gap-4 w-[500px] max-h-[70vh]"
        style={{
          background: C.surface,
          padding: "24px",
          borderRadius: "12px",
          border: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={handleNew}
          className="px-4 py-3 rounded-md text-sm font-medium transition-colors"
          style={{ background: C.accent, color: "#fff" }}
        >
          + Nyt layout
        </button>

        {error && (
          <p className="text-sm" style={{ color: "#ef5350" }}>
            {error}
          </p>
        )}

        {layoutList.length === 0 && !error && (
          <p className="text-sm text-center" style={{ color: C.textDim }}>
            Ingen layouts endnu. Opret et nyt for at komme i gang.
          </p>
        )}

        {layoutList.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 px-3 py-3 rounded-md border transition-colors cursor-pointer hover:bg-opacity-80"
            style={{
              background: C.bg,
              borderColor: C.border,
              color: C.text,
            }}
            onClick={() => handleLoad(l.id)}
          >
            <div className="flex-1">
              <div className="text-sm font-medium">{l.name}</div>
              <div className="text-xs" style={{ color: C.textDim }}>
                {l.floor_width}×{l.floor_height} · {l.rooms?.length ?? 0} rum
                ·{" "}
                {new Date(l.updated_at).toLocaleDateString("da-DK")}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(l.id);
              }}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: "transparent",
                color: "#ef5350",
                border: `1px solid #ef5350`,
              }}
            >
              Slet
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: C.textDim }}>
        Gemmes i Vercel Postgres via /api/layouts
      </p>
    </div>
  );
}