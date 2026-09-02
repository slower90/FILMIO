import { test, expect, type Page } from "@playwright/test";

const movies = [
  {
    id: 701,
    title: "A Quiet Signal",
    posterPath: "https://fixtures.invalid/cinema-os-poster.svg",
    releaseDate: "2024-02-01",
    overview: "A deterministic film fixture for the Cinema OS browser suite.",
    voteAverage: 8.2,
  },
  {
    id: 702,
    title: "The Second Frame",
    posterPath: "https://fixtures.invalid/cinema-os-poster.svg",
    releaseDate: "2023-06-15",
    overview: "A second deterministic film for the pairing ritual.",
    voteAverage: 7.8,
  },
  {
    id: 703,
    title: "The Long Cut",
    posterPath: "https://fixtures.invalid/cinema-os-poster.svg",
    releaseDate: "2022-11-20",
    overview:
      "A third deterministic film to keep the select controls realistic.",
    voteAverage: 7.4,
  },
];

async function installRecommendationFixture(
  page: Page,
  response: typeof movies,
  { responseGate }: { responseGate?: Promise<void> } = {},
) {
  await page.route("**/api/recommendations**", async (route) => {
    if (responseGate) await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  await page.route("https://fixtures.invalid/cinema-os-poster.svg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#182337"/></svg>',
    }),
  );
}

test.describe("Cinema OS browser behavior", () => {
  test("signed-out visitors can read the signal and use private local modules", async ({
    page,
  }) => {
    await installRecommendationFixture(page, movies);
    await page.goto("/cinema-os");

    await expect(page.getByTestId("heading-cinema-os")).toBeVisible();
    await expect(page.getByTestId("status-cinema-os-signed-out")).toBeVisible();
    await expect(page.getByTestId("card-cinema-os-film-701")).toBeVisible();
    await expect(
      page.getByTestId("status-cinema-os-dna-signed-out"),
    ).toHaveText("Sign in to turn your choices into a pattern.");

    const afterglow = page.getByTestId("textarea-cinema-os-afterglow");
    await afterglow.fill("The quiet opening kept returning to me.");
    await page.getByTestId("button-cinema-os-save-afterglow").click();
    await expect(page.getByTestId("status-cinema-os-save")).toHaveText(
      "Afterglow saved. Saved on this device.",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("filmio:cinema-os:afterglow"),
        ),
      )
      .toContain("The quiet opening kept returning to me.");

    await page.getByTestId("button-cinema-os-spoiler-toggle").click();
    await expect(page.getByTestId("textarea-cinema-os-spoiler")).toBeVisible();
    await page
      .getByTestId("textarea-cinema-os-spoiler")
      .fill("The last shot changes the whole shape.");
    await page.getByTestId("button-cinema-os-save-spoiler").click();
    await expect(page.getByTestId("status-cinema-os-save")).toHaveText(
      "Spoiler Vault updated. Saved on this device.",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("filmio:cinema-os:spoiler-vault"),
        ),
      )
      .toContain("The last shot changes the whole shape.");

    await page.getByTestId("select-cinema-os-feature-1").selectOption("701");
    await page.getByTestId("select-cinema-os-feature-2").selectOption("702");
    await expect(page.getByTestId("text-cinema-os-feature-status")).toHaveText(
      "A Quiet Signal meets The Second Frame.",
    );
    await expect(
      page.getByTestId("button-cinema-os-save-feature"),
    ).toBeEnabled();
    await page.getByTestId("button-cinema-os-save-feature").click();
    await expect(page.getByTestId("status-cinema-os-save")).toHaveText(
      "Double feature held. Saved on this device.",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("filmio:cinema-os:double-feature"),
        ),
      )
      .toContain("[701,702]");

    await expect(page.getByTestId("text-cinema-os-passport-count")).toHaveText(
      "0",
    );
    await page.getByTestId("button-cinema-os-passport-stamp").click();
    await expect(page.getByTestId("text-cinema-os-passport-count")).toHaveText(
      "1",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("filmio:cinema-os:passport"),
        ),
      )
      .toBe("1");

    await expect(
      page.getByTestId("button-cinema-os-curriculum-progress"),
    ).toHaveText("Mark step 1");
    await page.getByTestId("button-cinema-os-curriculum-progress").click();
    await expect(
      page.getByTestId("button-cinema-os-curriculum-progress"),
    ).toHaveText("Mark step 2");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("filmio:cinema-os:curriculum"),
        ),
      )
      .toBe("2");
  });

  test("signal loading renders before a deterministic catalogue response arrives", async ({
    page,
  }) => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await installRecommendationFixture(page, movies, { responseGate });
    await page.goto("/cinema-os");

    await expect(
      page.getByTestId("status-cinema-os-signal-loading"),
    ).toBeVisible();
    releaseResponse();
    await expect(page.getByTestId("card-cinema-os-film-701")).toBeVisible();
  });

  test("a loaded empty catalogue renders safe signal and pairing states", async ({
    page,
  }) => {
    await installRecommendationFixture(page, []);
    await page.goto("/cinema-os");

    await expect(page.getByTestId("status-cinema-os-signed-out")).toBeVisible();
    await expect(page.getByTestId("status-cinema-os-signal-empty")).toHaveText(
      "A quiet catalogueThere is no live film signal to place here yet. Start with Tonight Mode when the catalogue returns.",
    );
    await expect(
      page.getByTestId("status-cinema-os-afterglow-empty"),
    ).toHaveText("Choose a film above to begin a note.");
    await expect(
      page.getByTestId("status-cinema-os-double-feature-empty"),
    ).toHaveText("Two live catalogue films are needed to build a pairing.");
    await expect(
      page.getByTestId("button-cinema-os-save-feature"),
    ).toBeDisabled();
  });
});
