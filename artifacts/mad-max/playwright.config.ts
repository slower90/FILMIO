import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices, chromium } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "22521";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

function resolveChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  try {
    const nixChromium = readdirSync("/nix/store")
      .filter((entry) => entry.includes("ungoogled-chromium-"))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((entry) => join("/nix/store", entry, "bin/chromium"))
      .find((candidate) => existsSync(candidate));
    if (nixChromium) return nixChromium;
  } catch {
    // The fallback is useful on non-Nix CI runners.
  }

  return undefined;
}

const chromiumExecutable = resolveChromiumExecutable();

export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL,
    browserName: "chromium",
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: `PORT=${port} BASE_PATH=/ pnpm run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});