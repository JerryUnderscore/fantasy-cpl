import { test, expect } from "@playwright/test";

test.describe("Leagues hub", () => {
  test("join panel validates codes and sends normalized invite", async ({ page }) => {
    await page.goto("/leagues", { waitUntil: "networkidle" });

    const joinInput = page.getByPlaceholder("Enter invite code");
    await joinInput.fill("ab");
    await page.getByRole("button", { name: "Join league" }).click();
    await expect(page.getByText("Invite code seems too short.")).toBeVisible();

    const requests: Array<Record<string, unknown>> = [];
    await page.route("**/api/leagues/join", (route) => {
      const body = route.request().postData() ?? "{}";
      requests.push(JSON.parse(body));
      route.fulfill({ status: 200, body: "{}" });
    });

    await joinInput.fill("test123");
    await page.getByRole("button", { name: "Join league" }).click();
    await expect(page).toHaveURL(/\/leagues(\?|$)/);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).toEqual({ inviteCode: "TEST123" });
  });

  test("league row copy invite toggles button text", async ({ page }) => {
    await page.goto("/leagues", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.resolve(),
        },
        configurable: true,
      });
    });

    const copyButton = page.getByRole("button", { name: "Copy invite" });
    await copyButton.click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  });
});
