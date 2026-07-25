import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe.configure({ mode: "serial" });

test("submit case and automatically assign group", async ({ page }) => {
  await login(page, "requester@example.com");
  await page.goto("/cases/new");

  await page.getByLabel("Title").fill("E2E auto assignment case");
  await page
    .getByLabel("Description")
    .fill("Playwright creates a case that should match wallet duplicate rules.");
  await page.getByLabel("Account ID").fill("ACC-E2E-001");
  await page.getByLabel("Reference ID").fill("REF-E2E-001");
  await page.getByLabel("Adjustment amount").fill("125.50");

  await page.getByLabel("Adjustment type").click();
  await page.getByRole("option", { name: "Credit" }).click();

  await page.getByText("Category", { exact: true }).locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Wallet adjustments" }).click();

  await page.getByText("Subcategory", { exact: true }).locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Duplicate credit" }).click();

  await page.getByRole("button", { name: /submit case/i }).click();
  await expect(page).toHaveURL(/\/cases\/.+/);
  await expect(page.getByText("Wallet Operations")).toBeVisible();
  await signOut(page);
});

test("agent claims and acknowledges case", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/workspace");
  await expect(page.getByText("Unassigned cases for my groups")).toBeVisible();

  const caseLink = page.locator('a[href^="/cases/"]').filter({
    hasText: "E2E auto assignment case",
  }).first();
  await caseLink.click();

  await page.getByRole("button", { name: /claim case/i }).click();
  await expect(page.getByText("Sam Operations")).toBeVisible();

  await page.getByRole("button", { name: /acknowledge/i }).click();
  await expect(page.getByText("Case acknowledged by agent.")).toBeVisible();
  await signOut(page);
});

test("case reaches pending approval and approver is notified", async ({
  page,
}) => {
  await login(page, "agent@example.com");
  await page.goto("/cases");
  await page
    .locator('a[href^="/cases/"]')
    .filter({ hasText: "E2E auto assignment case" })
    .first()
    .click();

  await page.getByRole("button", { name: /move to under review/i }).click();
  await page.getByRole("button", { name: /confirm status change/i }).click();

  await page.getByRole("button", { name: /move to pending approval/i }).click();
  await page.getByRole("button", { name: /confirm status change/i }).click();
  await expect(page.getByText("Pending Approval")).toBeVisible();
  await signOut(page);

  await login(page, "approver@example.com");
  await page.getByText("Notifications").click();
  await expect(page.getByText("Approval requested")).toBeVisible();
  await signOut(page);
});

test("SLA pauses while waiting for requester", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/cases");
  await page
    .locator('a[href^="/cases/"]')
    .filter({ hasText: "E2E auto assignment case" })
    .first()
    .click();

  // Move back to under review if needed via reopen path is not required;
  // from pending approval an agent cannot wait. Use chargeback seed case instead.
  await page.goto("/cases/cccccccc-cccc-cccc-cccc-cccccccccccc");
  // If still pending approval, skip wait transition and use a submitted-owned path:
  // Create wait on under-review case2.
  await page.goto("/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  await page.getByRole("button", { name: /move to waiting for requester/i }).click();
  await page.getByRole("button", { name: /confirm status change/i }).click();
  await expect(page.getByText("Waiting for requester")).toBeVisible();
  await expect(page.getByText("PAUSED")).toBeVisible();
  await signOut(page);
});

test("breached case appears in the breached queue", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Breached cases" })).toBeVisible();
  // Seeded SUBMITTED case (2 days old) exceeds medium first-response SLA.
  await expect(
    page.getByText("Duplicate deposit correction")
  ).toBeVisible();
  await signOut(page);
});
