import { test, expect } from "@playwright/test";

test.describe("My Teams dashboard", () => {
  test("renders compact list when multiple teams exist and opens team details", async ({ page }) => {
    await page.goto("/my-teams", { waitUntil: "networkidle" });

    await expect(page.getByTestId("teams-list-row-test-team-1")).toBeVisible();
    await expect(page.getByTestId("teams-list-row-test-team-2")).toBeVisible();

    await page.getByTestId("teams-list-row-test-team-1").click();

    await expect(page.getByRole("heading", { name: "Test Strikers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set lineup" })).toBeVisible();
    await expect(page.getByText("Lineup status")).toBeVisible();
  });
});
