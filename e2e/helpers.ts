import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";
export const TEST_CONTROL_SECRET =
  process.env.TEST_CONTROL_SECRET ?? "local-simulator-secret";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|cases|workspace|admin)/, {
    timeout: 30_000,
  });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/);
}

export async function drainJobs(
  request: APIRequestContext,
  workerId = `e2e-${Date.now()}`
) {
  const response = await request.post("/api/jobs/tick", {
    headers: {
      "x-jobs-tick-secret": TEST_CONTROL_SECRET,
      "content-type": "application/json",
    },
    data: { limit: 25, workerId },
  });
  expect(response.ok()).toBeTruthy();
}

export async function resetWalletMock(request: APIRequestContext) {
  const response = await request.post("/api/test-control/wallet/mock", {
    headers: {
      "x-test-control-secret": TEST_CONTROL_SECRET,
      "content-type": "application/json",
    },
    data: { action: "reset" },
  });
  expect(response.ok()).toBeTruthy();
}

export async function configureWalletMock(
  request: APIRequestContext,
  params: Record<string, unknown>
) {
  const response = await request.post("/api/test-control/wallet/mock", {
    headers: {
      "x-test-control-secret": TEST_CONTROL_SECRET,
      "content-type": "application/json",
    },
    data: { action: "set", ...params },
  });
  expect(response.ok()).toBeTruthy();
}

export async function confirmTransition(page: Page, buttonName: RegExp) {
  await page.getByRole("button", { name: buttonName }).click();
  await page.getByRole("button", { name: /confirm status change/i }).click();
  await page
    .getByRole("button", { name: /confirm status change/i })
    .waitFor({ state: "hidden", timeout: 15_000 });
}

export async function openCaseByTitle(page: Page, title: string) {
  await page
    .locator('a[href^="/cases/"]')
    .filter({ hasText: title })
    .first()
    .click();
  await page.getByRole("heading", { level: 1 }).waitFor();
}
