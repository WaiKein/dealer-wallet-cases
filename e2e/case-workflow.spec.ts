import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password123!";
const CASE_TITLE = `E2E auto assignment case ${Date.now()}`;

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

async function openCaseByTitle(page: Page, title: string) {
  await page
    .locator('a[href^="/cases/"]')
    .filter({ hasText: title })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function confirmTransition(page: Page, buttonName: RegExp) {
  await page.getByRole("button", { name: buttonName }).click();
  await page.getByRole("button", { name: /confirm status change/i }).click();
  await expect(
    page.getByRole("button", { name: /confirm status change/i })
  ).toHaveCount(0, { timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test("submit case and automatically assign group", async ({ page }) => {
  await login(page, "requester@example.com");
  await page.goto("/cases/new");

  await page.getByLabel("Title").fill(CASE_TITLE);
  await page
    .getByLabel("Description")
    .fill("Playwright creates a case that should match wallet duplicate rules.");
  await page.getByLabel("Adjustment amount").fill("125.50");

  await page.getByLabel("Adjustment type").click();
  await page.getByRole("option", { name: "Credit" }).click();

  await page.getByText("Category", { exact: true }).locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Wallet adjustments" }).click();

  await page.getByText("Subcategory", { exact: true }).locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: "Duplicate credit" }).click();

  await page.getByRole("button", { name: /submit case/i }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}/i);
  await expect(page.getByText("Wallet Operations")).toBeVisible();
  await signOut(page);
});

test("agent claims and acknowledges case", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/workspace");
  await expect(page.getByText("Unassigned cases for my groups")).toBeVisible();

  await openCaseByTitle(page, CASE_TITLE);

  await page.getByRole("button", { name: /claim case/i }).click();
  await expect(page.getByText("Assigned agent").locator("..").getByText("Sam Operations")).toBeVisible();

  await page.getByRole("button", { name: /acknowledge/i }).click();
  await expect(page.getByText("Case acknowledged by agent.")).toBeVisible();
  await signOut(page);
});

test("case reaches pending approval and approver is notified", async ({
  page,
}) => {
  await login(page, "agent@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, CASE_TITLE);

  await confirmTransition(page, /move to under review/i);
  await expect(page.getByText("Under Review", { exact: true })).toBeVisible();

  await confirmTransition(page, /move to pending approval/i);
  await expect(page.getByText("Pending Approval", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await signOut(page);

  await login(page, "approver@example.com");
  await page.getByText("Notifications").click();
  await expect(page.getByText("Approval requested").first()).toBeVisible();
  await signOut(page);
});

test("SLA pauses while waiting for requester", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/cases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  await confirmTransition(page, /move to waiting for requester/i);
  await expect(
    page.getByText("Waiting for requester", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("PAUSED", { exact: true })).toBeVisible();
  await signOut(page);
});

test("breached case appears in the breached queue", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/workspace");
  await expect(page.getByText("Breached cases")).toBeVisible();
  await expect(page.getByText("Duplicate deposit correction").first()).toBeVisible();
  await signOut(page);
});
