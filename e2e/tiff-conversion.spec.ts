import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURES = path.join(__dirname, "..", "test-fixtures", "tiff");

// Requires `npm run seed` to have been run against a real Supabase project
// (creates operator@cargopaf.test with a mailbox already configured) and
// `npm run dev` to be running. See docs/SETUP.md.
test("converts a valid TIFF to PDF and surfaces a corrupt one as a retryable error", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@cargopaf.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/batches/new");
  await page.getByLabel("Run name").fill(`E2E-TIFF-TEST-${Date.now()}`);
  await page.getByLabel("Send from mailbox").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create and continue" }).click();

  await page.waitForURL(/\/batches\/[^/]+\/mapping/);
  const batchId = page.url().match(/\/batches\/([^/]+)\/mapping/)?.[1];
  expect(batchId).toBeTruthy();

  await page.goto(`/batches/${batchId}/convert`);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(FIXTURES, "sample-valid.tiff"));
  await page.getByRole("button", { name: /Convert 1 file/ }).click();

  await expect(page.getByText("sample-valid.tiff")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("converted", { exact: true })).toBeVisible();

  await fileInput.setInputFiles(path.join(FIXTURES, "corrupt.tiff"));
  await page.getByRole("button", { name: /Convert 1 file/ }).click();

  await expect(page.getByText("corrupt.tiff")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
});
