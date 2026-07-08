import { defineConfig, devices } from "@playwright/test";

// The TIFF conversion e2e test drives a real logged-in wizard page, so it
// needs `npm run dev` running against a real Supabase project seeded via
// `npm run seed` (see docs/SETUP.md) — it cannot run against placeholder
// env vars the way the unit tests and build can.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
