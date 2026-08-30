import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page, type Route } from "@playwright/test";

const svgPoster = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513"><rect width="342" height="513" fill="${color}"/><circle cx="171" cy="215" r="80" fill="#f3b63f"/><path d="M115 330h112v20H115z" fill="#fff4d6"/></svg>`;

function loadVideoFixture() {
  const pnpmStore = join(process.cwd(), "../../node_modules/.pnpm");
  const vhsPackage = readdirSync(pnpmStore).find((entry) => entry.startsWith("@videojs+vhs-utils@"));
  if (!vhsPackage) throw new Error("The Video.js media fixture package is unavailable");
  const fixtureDir = join(
    pnpmStore,
    vhsPackage,
    "node_modules/@videojs/vhs-utils/test/fixtures/formats/webm",
  );
  const fixture = readdirSync(fixtureDir).find((entry) => entry.startsWith("vp8,opus"));
  if (!fixture) throw new Error("The Video.js WebM fixture is unavailable");
  return readFileSync(join(fixtureDir, fixture));
}

const fixtureVideo = loadVideoFixture();

const classics = Array.from({ length: 30 }, (_, index) => ({
  identifier: `browser-fixture-${index}`,
  title: index === 0 ? "Direct Video Fixture" : index === 1 ? "Fallback Fixture" : `Near Viewport Fixture ${index}`,
  description: "A deterministic browser fixture.",
  year: 1930 + index,
  creator: "FILMIO test fixture",
  posterUrl: `/browser-poster-${index}.svg`,
  embedUrl: `/browser-video-${index}.webm`,
  mediaUrl: index === 0 ? "/browser-video-0.webm" : null,
  source: "archive" as const,
  sourceLabel: "Internet Archive",
  sourceUrl: "https://archive.org/",
  playback: index === 0 ? ("video" as const) : ("iframe" as const),
  licenseLabel: "Public domain",
}));

const classicsResponse = {
  items: classics,
  fetchedAt: "2026-08-30T00:00:00.000Z",
  page: 1,
  totalPages: 1,
  totalResults: classics.length,
};

async function installFixtures(page: Page, { simulatePosterFailure = true } = {}) {
  await page.route("**/api/free-classics**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(classicsResponse),
    }),
  );

  await page.route("**/browser-poster-*.svg", async (route: Route) => {
    const index = Number(new URL(route.request().url()).pathname.match(/(\d+)\.svg$/)?.[1] ?? 0);
    if (simulatePosterFailure && index === 1) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: svgPoster(index % 2 === 0 ? "#182337" : "#3b2630"),
    });
  });

  await page.route("**/browser-video-*.webm", (route) =>
    route.fulfill({
      status: 200,
      contentType: "video/webm",
      body: fixtureVideo,
    }),
  );
}

async function disableNativeMediaLoading(page: Page) {
  await page.addInitScript(() => {
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
    if (srcDescriptor) {
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        configurable: true,
        get() {
          return this.getAttribute("data-browser-src") ?? "";
        },
        set(value: string) {
          this.setAttribute("data-browser-src", value);
        },
      });
    }
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value() {},
    });
  });
}

async function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      // Clerk's development instance can be unreachable in isolated test
      // runners; route smoke coverage should still report application errors.
      if (!text.includes("clerk.accounts.dev")) {
        errors.push(`console: ${text}`);
      }
    }
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test.describe("Free Classics browser behavior", () => {
  test("lazy images load near the viewport and expose an accessible fallback", async ({ page }) => {
    await installFixtures(page);
    await page.goto("/free-classics");

    const firstPoster = page.locator('img[src="/browser-poster-0.svg"]').last();
    await expect(firstPoster).toBeVisible();
    await expect(firstPoster).toHaveAttribute("loading", "lazy");

    const fallback = page.getByRole("img", { name: "Fallback Fixture poster" });
    await expect(fallback).toBeVisible();
    await expect(page.locator('img[src="/browser-poster-1.svg"]')).toHaveCount(0);

    const farPoster = page.locator('img[src="/browser-poster-29.svg"]');
    await expect(farPoster).toHaveCount(0);
    await page.locator('[data-testid="free-classics-grid"]').evaluate((grid) => {
      grid.scrollIntoView({ block: "end" });
    });
    await expect(farPoster).toHaveCount(2);
  });

  test("direct video reports play, pause, seek, buffering, and control visibility states", async ({ page }, testInfo) => {
    await disableNativeMediaLoading(page);
    await installFixtures(page);
    await page.goto("/free-classics");
    await page.getByTestId("card-free-classic-archive-browser-fixture-0").click();

    const video = page.locator('video[data-testid="video-free-classic-archive-browser-fixture-0"]');
    const player = page.locator(".filmio-video-player .video-js");
    const feedback = page.getByTestId("free-classics-player-feedback");
    const controlBar = page.locator(".filmio-video-player .vjs-control-bar");
    await expect(video).toBeVisible();
    await player.evaluate((element) => {
      element.classList.remove("vjs-user-inactive");
      element.classList.add("vjs-user-active");
    });
    await expect(controlBar).toHaveCSS("opacity", "1");
    await expect(controlBar).toHaveCSS("visibility", "visible");

    const emit = async (eventName: string, expected: string) => {
      await video.evaluate((element, eventType) => {
        element.dispatchEvent(new Event(eventType, { bubbles: false }));
      }, eventName);
      await expect(feedback).toHaveText(expected);
    };

    await emit("play", "Playing");
    await emit("pause", "Paused");
    await emit("seeking", "Seeking");
    await emit("waiting", "Buffering");

    await player.evaluate((element) => element.classList.add("vjs-user-inactive"));
    await expect(controlBar).toHaveCSS("opacity", testInfo.project.name === "mobile" ? "1" : "0");
    await player.hover();
    await expect(controlBar).toHaveCSS("opacity", "1");
  });

  test("reduced motion disables player transitions and keeps controls visible", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await disableNativeMediaLoading(page);
    await installFixtures(page);
    await page.goto("/free-classics");
    await page.getByTestId("card-free-classic-archive-browser-fixture-0").click();

    const controlBar = page.locator(".filmio-video-player .vjs-control-bar");
    const player = page.locator(".filmio-video-player .video-js");
    await player.evaluate((element) => element.classList.add("vjs-user-inactive"));
    const transitionDuration = await controlBar.evaluate(
      (element) => parseFloat(getComputedStyle(element).transitionDuration) || 0,
    );
    expect(transitionDuration).toBeLessThan(0.001);
    await expect(controlBar).toHaveCSS("opacity", "1");
    await expect(controlBar).toHaveCSS("visibility", "visible");
  });

  test("desktop and mobile routes load without browser errors", async ({ page }) => {
    const errors = await collectBrowserErrors(page);
    await installFixtures(page, { simulatePosterFailure: false });
    await page.goto("/help");
    await expect(page.locator("main")).toBeVisible();
    await page.goto("/free-classics");
    await expect(page.getByTestId("free-classics-section")).toBeVisible();
    expect(errors).toEqual([]);
  });
});