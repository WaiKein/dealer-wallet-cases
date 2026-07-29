import { expect, test } from "@playwright/test";
import {
  configureWalletMock,
  confirmTransition,
  drainJobs,
  login,
  openCaseByTitle,
  resetWalletMock,
  signOut,
} from "./helpers";

const RULE_CODE = `E2E_RULE_${Date.now()}`;
const HAPPY_CASE_TITLE = `E2E pilot happy path ${Date.now()}`;
const RETRY_CASE_TITLE = `E2E pilot retry path ${Date.now()}`;

test.describe.configure({ mode: "serial" });

test("[RB-ADMIN-APPROVAL-RULE-CREATE] administrator configures an approval rule", async ({ page }) => {
  await login(page, "admin@example.com");
  await page.goto("/admin/approval-rules");

  await page.getByLabel("Code").fill(RULE_CODE);
  await page.getByLabel("Name").fill("E2E pilot approval rule");
  await page.getByLabel("Sequence").fill("5");
  await page.getByLabel("Min amount").fill("1");
  await page.getByLabel("Max amount").fill("50000");
  await page.locator("#required_approver_role").selectOption("approver");
  await page.getByLabel("Approval levels").fill("1");
  await page.getByLabel("Change reason").fill("E2E pilot rule setup");
  await page.getByRole("button", { name: /create approval rule/i }).click();

  await expect(page.getByText(RULE_CODE)).toBeVisible({ timeout: 15_000 });
  await signOut(page);
});

test("[RB-CASE-CREATE-VALID] requester creates an adjustment case", async ({ page }) => {
  await login(page, "requester@example.com");
  await page.goto("/cases/new");

  await page.getByLabel("Title").fill(HAPPY_CASE_TITLE);
  await page
    .getByLabel("Description")
    .fill("E2E pilot workflow covering approval and execution.");
  await page.getByLabel("Adjustment amount").fill("210.00");
  await page.getByLabel("Adjustment type").click();
  await page.getByRole("option", { name: "Credit" }).click();
  await page
    .getByText("Category", { exact: true })
    .locator("..")
    .getByRole("combobox")
    .click();
  await page.getByRole("option", { name: "Wallet adjustments" }).click();
  await page
    .getByText("Subcategory", { exact: true })
    .locator("..")
    .getByRole("combobox")
    .click();
  await page.getByRole("option", { name: "Duplicate credit" }).click();

  await page.getByRole("button", { name: /submit case/i }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}/i);
  await signOut(page);
});

test("[RB-CASE-CLAIM] [RB-CASE-ACKNOWLEDGE] agent reviews and requests approval", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/workspace");
  await openCaseByTitle(page, HAPPY_CASE_TITLE);

  await page.getByRole("button", { name: /claim case/i }).click();
  await page.getByRole("button", { name: /acknowledge/i }).click();
  await expect(page.getByText("Case acknowledged by agent.")).toBeVisible();

  await confirmTransition(page, /move to under review/i);
  await expect(page.getByText("Under Review", { exact: true })).toBeVisible();
  await confirmTransition(page, /move to pending approval/i);
  await expect(page.getByText("Pending Approval", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await signOut(page);
});

test("[RB-APPROVAL-HAPPY] approver approves the request", async ({ page }) => {
  await login(page, "approver@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, HAPPY_CASE_TITLE);

  await confirmTransition(page, /move to approved/i);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await signOut(page);
});

test("[RB-WALLET-SUCCESS] [RB-CASE-RESOLVE] mock execution succeeds and case is resolved", async ({
  page,
  request,
}) => {
  await resetWalletMock(request);
  await configureWalletMock(request, {
    scope: "default",
    executeOutcome: "SUCCESS",
  });

  await drainJobs(request);
  await drainJobs(request);

  await login(page, "agent@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, HAPPY_CASE_TITLE);

  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await confirmTransition(page, /move to resolved/i);
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await signOut(page);
});

test("[RB-CASE-TIMELINE-VISIBLE] full timeline is visible on the resolved case", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, HAPPY_CASE_TITLE);

  await expect(page.getByRole("heading", { name: "Status history" })).toBeVisible();
  await expect(page.getByText("Submitted → Under Review")).toBeVisible();
  await expect(page.getByText("Pending Approval → Approved")).toBeVisible();
  await expect(page.getByText("Approved → Resolved")).toBeVisible();
  await signOut(page);
});

test("[RB-EXCEPTION-PERMANENT-FAILURE] failed integration appears in the exception workspace", async ({
  page,
  request,
}) => {
  await resetWalletMock(request);
  await configureWalletMock(request, {
    scope: "default",
    executeOutcome: "TEMPORARY_FAILURE",
  });

  await login(page, "requester@example.com");
  await page.goto("/cases/new");
  await page.getByLabel("Title").fill(RETRY_CASE_TITLE);
  await page.getByLabel("Description").fill("Retryable integration failure.");
  await page.getByLabel("Adjustment amount").fill("99.00");
  await page.getByLabel("Adjustment type").click();
  await page.getByRole("option", { name: "Credit" }).click();
  await page
    .getByText("Category", { exact: true })
    .locator("..")
    .getByRole("combobox")
    .click();
  await page.getByRole("option", { name: "Wallet adjustments" }).click();
  await page
    .getByText("Subcategory", { exact: true })
    .locator("..")
    .getByRole("combobox")
    .click();
  await page.getByRole("option", { name: "Duplicate credit" }).click();
  await page.getByRole("button", { name: /submit case/i }).click();
  await signOut(page);

  await login(page, "agent@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, RETRY_CASE_TITLE);
  await page.getByRole("button", { name: /claim case/i }).click();
  await page.getByRole("button", { name: /acknowledge/i }).click();
  await confirmTransition(page, /move to under review/i);
  await confirmTransition(page, /move to pending approval/i);
  await signOut(page);

  await login(page, "approver@example.com");
  await page.goto("/cases");
  await openCaseByTitle(page, RETRY_CASE_TITLE);
  await confirmTransition(page, /move to approved/i);
  await signOut(page);

  await drainJobs(request);
  await drainJobs(request);

  await login(page, "teamlead@example.com");
  await page.goto("/operations/exceptions");
  await expect(page.getByText(RETRY_CASE_TITLE).first()).toBeVisible({
    timeout: 20_000,
  });
  await signOut(page);
});

test("[RB-EXCEPTION-RETRY-UI] [RB-WALLET-RETRY-SUCCESS] team lead safely retries a retryable failure", async ({
  page,
  request,
}) => {
  await configureWalletMock(request, {
    scope: "default",
    executeOutcome: "SUCCESS",
  });

  await login(page, "teamlead@example.com");
  await page.goto("/operations/exceptions");
  const row = page.locator("article, li, div").filter({ hasText: RETRY_CASE_TITLE }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /retry execution/i }).click();

  await drainJobs(request);
  await drainJobs(request);

  await page.goto("/cases");
  await openCaseByTitle(page, RETRY_CASE_TITLE);
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await signOut(page);
});

test("[RB-DASHBOARD-KPI-LOAD] manager views dashboard KPIs", async ({ page }) => {
  await login(page, "teamlead@example.com");
  await page.goto("/dashboard/management");
  await expect(page.getByText("Management dashboard")).toBeVisible();
  await expect(page.getByText("Cases submitted")).toBeVisible();
  await expect(page.getByText("Pending approval")).toBeVisible();
  await expect(page.getByText("Failed integration")).toBeVisible();
  await signOut(page);
});

test("[RB-VIEW-LIST-CREATE-PERSONAL] user creates and reopens a saved view", async ({ page }) => {
  const viewName = `E2E view ${Date.now()}`;

  await login(page, "agent@example.com");
  await page.goto("/cases?status=UNDER_REVIEW");
  await page.getByLabel("Save current filters").fill(viewName);
  await page.getByRole("button", { name: /save personal view/i }).click();
  await expect(page.getByText(viewName)).toBeVisible({ timeout: 15_000 });

  await page.goto("/cases");
  await page.getByLabel("Saved view").click();
  await page.getByRole("option", { name: new RegExp(viewName) }).click();
  await expect(page).toHaveURL(/viewId=/);
  await signOut(page);
});

test("[RB-NAV-ADMIN-DENIED] unauthorised user is denied administration access", async ({ page }) => {
  await login(page, "agent@example.com");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
  await signOut(page);
});
