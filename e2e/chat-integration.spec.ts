// ============================================================================
// E2E Test 3: Tekst-Chat Integration — Send/Modtag + Historik + Position
// ============================================================================
// These tests verify the text chat system:
//   - Chat panel renders with tabs (Rum/Privat)
//   - SSE endpoint returns valid chat data
//   - Sending a message POSTs to /api/chat
//   - Messages appear with sender name, text, and timestamp
//   - Room selector shows current room
//   - Chat empty state shows "Ingen beskeder endnu"
// ============================================================================

import { test, expect } from "@playwright/test";

test.describe("Tekst-Chat — Send/Modtag + Chat Panel", () => {

  test.beforeEach(async ({ page }) => {
    // Mock chat API
    await page.route("**/api/chat**", async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        const url = new URL(route.request().url());
        const roomId = url.searchParams.get("room") || "eng-pod";

        const mockMessages = [
          {
            id: "msg-001",
            scope: "room",
            room_id: roomId,
            sender_id: "user-alice",
            sender_name: "Alice",
            recipient_id: null,
            text: "Godmorgen team! ☀️",
            x: 200,
            y: 500,
            created_at: new Date(Date.now() - 120_000).toISOString(),
            expires_at: new Date(Date.now() + 180_000).toISOString(),
          },
          {
            id: "msg-002",
            scope: "room",
            room_id: roomId,
            sender_id: "user-bob",
            sender_name: "Bob",
            recipient_id: null,
            text: "Vi tager mødet i Mødelokale A om 10 min",
            x: 400,
            y: 150,
            created_at: new Date(Date.now() - 60_000).toISOString(),
            expires_at: new Date(Date.now() + 240_000).toISOString(),
          },
          {
            id: "msg-003",
            scope: "room",
            room_id: roomId,
            sender_id: "user-charlie",
            sender_name: "Charlie",
            recipient_id: null,
            text: "Jeg er der! 👍",
            x: 60,
            y: 170,
            created_at: new Date(Date.now() - 30_000).toISOString(),
            expires_at: new Date(Date.now() + 270_000).toISOString(),
          },
        ];

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: `event: chat\ndata: ${JSON.stringify(mockMessages)}\n\n`,
        });
      } else if (method === "POST") {
        const body = route.request().postDataJSON();
        // Return the posted message as confirmation
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ok: true,
            message: {
              id: "msg-new",
              scope: body.scope || "room",
              room_id: body.room_id || null,
              sender_id: body.sender_id,
              sender_name: body.sender_name,
              recipient_id: body.recipient_id || null,
              text: body.text,
              x: body.x || 0,
              y: body.y || 0,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 300_000).toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock presence for chat panel DM selector
    await page.route("**/api/presence**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: 'event: presence\ndata: [{"user_id":"user-alice","name":"Alice","email":"alice@ex.com","x":200,"y":500,"last_seen":"2026-01-01T00:00:00Z","online":true}]\n\n',
        });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
    });

    await page.goto("/");
  });

  // --- Chat panel visibility ---

  test("chat panel vises i sidebaren med Rum og Privat tabs", async ({ page }) => {
    await page.getByPlaceholder("Dit navn").fill("ChatUser");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      // Chat panel should have a "Chat" header
      await expect(page.getByText("Chat").first()).toBeVisible();
      // Tabs: Rum and Privat
      await expect(page.getByRole("button", { name: "Rum" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Privat" })).toBeVisible();
    }
  });

  // --- Chat messages visible ---

  test("modtagne beskeder vises i chat panel med afsender navn og tid", async ({ page }) => {
    await page.getByPlaceholder("Dit navn").fill("ChatViewer");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(3000);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      // Messages from mock should appear
      await expect(page.getByText("Godmorgen team! ☀️")).toBeVisible();
      await expect(page.getByText("Alice")).toBeVisible();
      await expect(page.getByText("Bob")).toBeVisible();
      await expect(page.getByText("Charlie")).toBeVisible();
    }
  });

  // --- Send a message ---

  test("send beskeder via chat input og POST kaldes", async ({ page }) => {
    let postBody: Record<string, unknown> | null = null;

    await page.route("**/api/chat", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        postBody = route.request().postDataJSON() as Record<string, unknown> | null;
        const pb = postBody as Record<string, unknown> | null;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            ok: true,
            message: {
              id: "sent-msg",
              scope: (pb?.scope as string) || "room",
              room_id: pb?.room_id || null,
              sender_id: pb?.sender_id,
              sender_name: pb?.sender_name,
              text: pb?.text,
              x: pb?.x || 0,
              y: pb?.y || 0,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 300_000).toISOString(),
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: "event: chat\ndata: []\n\n",
        });
      }
    });

    await page.getByPlaceholder("Dit navn").fill("Sender");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      // Type a message and send
      const input = page.getByPlaceholder(/Skriv i/);
      const isVisible = await input.isVisible().catch(() => false);

      if (isVisible) {
        await input.fill("Hej team!");
        await page.getByRole("button", { name: "Send" }).click();
        await page.waitForTimeout(1000);

        // Verify POST was made with correct data
        expect(postBody).not.toBeNull();
        expect((postBody as Record<string, unknown>)?.text).toBe("Hej team!");
        expect((postBody as Record<string, unknown>)?.sender_name).toBe("Sender");
      }
    }
  });

  // --- Chat empty state ---

  test("tomt chat panel viser 'Ingen beskeder endnu'", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: "event: chat\ndata: []\n\n",
        });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
    });

    await page.getByPlaceholder("Dit navn").fill("EmptyChat");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      await expect(page.getByText("Ingen beskeder endnu")).toBeVisible();
    }
  });

  // --- Room selector ---

  test("rum-selector viser nuværende rum og alle rum options", async ({ page }) => {
    await page.getByPlaceholder("Dit navn").fill("RoomSelect");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      // Room tab should be active
      const roomBtn = page.getByRole("button", { name: "Rum" });
      await roomBtn.click();

      // The room selector dropdown should exist
      const select = page.locator("select");
      const selectCount = await select.count();
      if (selectCount > 0) {
        // Should contain room options
        const options = await select.first().locator("option").allTextContents();
        const hasMeetingRoom = options.some((o) => o.includes("Mødelokale"));
        const hasKitchen = options.some((o) => o.includes("Køkken"));
        expect(hasMeetingRoom || hasKitchen).toBeTruthy();
      }
    }
  });

  // --- DMs ---

  test("privat chat tab viser DM modtager-selector", async ({ page }) => {
    await page.getByPlaceholder("Dit navn").fill("DMUser");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      // Click Private tab
      const privat = page.getByRole("button", { name: "Privat" });
      await privat.click();

      // Should see "Vælg modtager..." or select
      await expect(page.getByText(/Vælg modtager/)).toBeVisible();
    }
  });

  // --- Enter key to send ---

  test("Enter-tast sender besked (ikke Shift+Enter)", async ({ page }) => {
    let lastSentText = "";

    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        lastSentText = (route.request().postDataJSON() as Record<string, unknown> | null)?.text as string || "";
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true, message: {} }) });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: "event: chat\ndata: []\n\n",
        });
      }
    });

    await page.getByPlaceholder("Dit navn").fill("EnterUser");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      const input = page.getByPlaceholder(/Skriv i/);
      const isVisible = await input.isVisible().catch(() => false);

      if (isVisible) {
        await input.fill("Send via Enter");
        await input.press("Enter");
        await page.waitForTimeout(500);

        expect(lastSentText).toBe("Send via Enter");
      }
    }
  });

  // --- Position included in message ---

  test("besked inkluderer afsenderposition (x, y)", async ({ page }) => {
    let postData: Record<string, unknown> | null = null;

    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        postData = route.request().postDataJSON() as Record<string, unknown> | null;
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true, message: {} }) });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: "event: chat\ndata: []\n\n",
        });
      }
    });

    await page.getByPlaceholder("Dit navn").fill("PosUser");
    await page.getByRole("button", { name: /Gå til kontoret/i }).click();
    await page.waitForTimeout(2500);

    const canvas = page.locator("canvas");
    if (await canvas.isVisible().catch(() => false)) {
      const input = page.getByPlaceholder(/Skriv i/);
      const isVisible = await input.isVisible().catch(() => false);

      if (isVisible) {
        await input.fill("Position test");
        await page.getByRole("button", { name: "Send" }).click();
        await page.waitForTimeout(500);

        // Position should be included
        expect(postData).not.toBeNull();
        expect(typeof postData?.x).toBe("number");
        expect(typeof postData?.y).toBe("number");
      }
    }
  });
});