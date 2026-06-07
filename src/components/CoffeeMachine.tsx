"use client";

// VirtualOffice — CoffeeMachine
// Toast/banner-komponent der viser dagens virtuelle kaffematch.
//
// Tre tilstande:
//   1. idle:  "☕ Tag en kaffepause" knap — brugeren har ikke matchet i dag
//   2. match: Viser hvem man er matchet med + "venter på svar"
//   3. mutual: Begge har matchet hinanden → fejring med animation

import { useEffect, useState } from "react";
import { useCoffeeMatch } from "@/hooks/useCoffeeMatch";

// ── Colour constants (matching page.tsx / OfficeCanvas theme) ────────────────

const COLOURS = {
  bg: "#1a1d23",
  surface: "#22262d",
  border: "#2e333b",
  text: "#d4d6db",
  textDim: "#888c94",
  accent: "#5b9bd5",
  green: "#4caf50",
  amber: "#ffa726",
  orange: "#e67e22",
  brown: "#a0522d",
  cream: "#f5e6d3",
};

// ── Props ──────────────────────────────────────────────────────────────────

export interface CoffeeMachineProps {
  userId: string;
  userName: string;
}

// ── Helper: format name for display ────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string): string {
  const palette = [
    "#5b9bd5", "#4caf50", "#ffa726", "#ef5350",
    "#ab47bc", "#26c6da", "#ec407a", "#7e57c2",
    "#66bb6a", "#42a5f5", "#ff7043", "#8d6e63",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CoffeeMachine({ userId, userName }: CoffeeMachineProps) {
  const { match, loading, error, requestMatch, dismiss, dismissed } =
    useCoffeeMatch(userId, userName);

  const [newlyMutual, setNewlyMutual] = useState(false);

  // Detect newly mutual matches (for celebration animation)
  useEffect(() => {
    if (match?.is_mutual) {
      setNewlyMutual(true);
      const t = setTimeout(() => setNewlyMutual(false), 4_000);
      return () => clearTimeout(t);
    }
  }, [match?.is_mutual]);

  // Don't render if dismissed or no userId
  if (dismissed || !userId) return null;

  // ── Mutual match celebration ────────────────────────────────────────────

  if (match?.is_mutual) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl shadow-2xl border animate-bounce-in"
        style={{
          background: COLOURS.surface,
          borderColor: COLOURS.green,
          borderWidth: 2,
        }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl" role="img" aria-label="coffee">
              ☕
            </span>
            <div>
              <h3 className="text-sm font-bold" style={{ color: COLOURS.green }}>
                {newlyMutual ? "🎉 Kaffematch!" : "Dagens kaffematch"}
              </h3>
              <p className="text-xs" style={{ color: COLOURS.textDim }}>
                I har matchet hinanden — tid til en pause!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Your avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: avatarColor(userName) }}
            >
              {initials(userName)}
            </div>
            <div className="flex-1 text-center">
              <span className="text-lg" role="img" aria-label="heart">
                ❤️
              </span>
            </div>
            {/* Their avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: avatarColor(match.matched_user_name) }}
            >
              {initials(match.matched_user_name)}
            </div>
          </div>

          <p className="text-xs text-center mt-3" style={{ color: COLOURS.text }}>
            Dig &{" "}
            <span className="font-semibold">{match.matched_user_name}</span>{" "}
            — gå hen til hinanden og sig hej! 👋
          </p>

          <button
            className="w-full mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: COLOURS.border,
              color: COLOURS.textDim,
            }}
            onClick={dismiss}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  // ── Active (one-way) match ──────────────────────────────────────────────

  if (match && !match.is_mutual) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl shadow-2xl border"
        style={{
          background: COLOURS.surface,
          borderColor: COLOURS.border,
        }}
      >
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" role="img" aria-label="coffee">
              ☕
            </span>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: COLOURS.amber }}>
                Kaffematch venter
              </h3>
              <p className="text-xs" style={{ color: COLOURS.textDim }}>
                Du er matchet — venter på at{" "}
                <span className="font-medium" style={{ color: COLOURS.text }}>
                  {match.matched_user_name}
                </span>{" "}
                også matcher dig
              </p>
            </div>
          </div>

          {/* Spinner animation */}
          <div className="flex justify-center py-2">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    background: COLOURS.amber,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </span>
          </div>

          <button
            className="w-full mt-2 px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: COLOURS.border,
              color: COLOURS.textDim,
            }}
            onClick={dismiss}
          >
            Skjul
          </button>
        </div>
      </div>
    );
  }

  // ── Idle: no match yet — show the coffee button ─────────────────────────

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
    >
      <button
        className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        style={{
          background: COLOURS.surface,
          borderColor: COLOURS.border,
        }}
        onClick={requestMatch}
        disabled={loading}
      >
        <span className="text-2xl" role="img" aria-label="coffee">
          ☕
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold" style={{ color: COLOURS.text }}>
            {loading ? "Finder kaffemakker..." : "Tag en kaffepause"}
          </p>
          <p className="text-xs" style={{ color: COLOURS.textDim }}>
            {loading
              ? "Matcher dig med en online kollega..."
              : "Bliv matchet med en tilfældig kollega"}
          </p>
        </div>
      </button>

      {/* Error toast */}
      {error && (
        <div
          className="mt-2 px-3 py-2 rounded-md text-xs border max-w-sm"
          style={{
            background: COLOURS.surface,
            borderColor: "#ef535066",
            color: "#ef5350",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              className="font-bold text-xs hover:opacity-70"
              onClick={dismiss}
              style={{ color: "#ef5350" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline keyframe (injected via style tag) ───────────────────────────────
// The bounce-in animation for mutual match celebration
const style = typeof document !== "undefined" ? document.createElement("style") : null;
if (style) {
  style.textContent = `
    @keyframes bounce-in {
      0%   { transform: scale(0.8); opacity: 0; }
      60%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-bounce-in {
      animation: bounce-in 0.4s ease-out;
    }
  `;
  document.head.appendChild(style);
}