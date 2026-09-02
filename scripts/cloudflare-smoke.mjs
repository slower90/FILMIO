const siteUrl = new URL(process.env.FILMIO_SITE_URL ?? "https://vishnuva.in");
const apiUrl = new URL(
  process.env.FILMIO_API_URL ??
    "https://filmio-api-workers.py3912458.workers.dev",
);
const bearerToken = process.env.FILMIO_SMOKE_BEARER_TOKEN?.trim() ?? "";

function apiPath(path) {
  return new URL(path, apiUrl).toString();
}

async function request(name, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  console.log(`${name}: ${response.status} ${url}`);
  return response;
}

async function expectStatus(name, url, status, init = {}) {
  const response = await request(name, url, init);
  if (response.status !== status) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`${name} expected ${status}, received ${response.status}: ${body}`);
  }
  return response;
}

async function expectJson(name, url, status, validate, init = {}) {
  const response = await expectStatus(name, url, status, init);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${name} did not return valid JSON`);
  }
  if (!validate(payload)) {
    throw new Error(`${name} returned an unexpected JSON shape`);
  }
  return payload;
}

await expectStatus("Pages homepage", siteUrl.toString(), 200);

await expectJson(
  "Worker health",
  apiPath("/api/healthz"),
  200,
  (payload) => payload?.status === "ok",
);

await expectJson(
  "Movie catalog",
  apiPath("/api/movies/catalog?collection=popular&page=1&limit=1"),
  200,
  (payload) => Array.isArray(payload?.results),
);

await expectJson(
  "Reviews",
  apiPath("/api/reviews?page=1&limit=1"),
  200,
  (payload) => Array.isArray(payload),
);

const corsResponse = await expectStatus(
  "CORS preflight",
  apiPath("/api/healthz"),
  204,
  {
    method: "OPTIONS",
    headers: {
      Origin: siteUrl.origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "content-type",
    },
  },
);
if (corsResponse.headers.get("access-control-allow-origin") !== siteUrl.origin) {
  throw new Error("CORS preflight did not allow the configured site origin");
}

await expectStatus("Anonymous users/me guard", apiPath("/api/users/me"), 401);
await expectStatus("Anonymous watchlist guard", apiPath("/api/watchlist"), 401);

if (!bearerToken) {
  console.warn(
    "Signed-in Clerk smoke checks skipped: set FILMIO_SMOKE_BEARER_TOKEN to enable them.",
  );
} else {
  const authHeaders = { Authorization: `Bearer ${bearerToken}` };
  await expectJson(
    "Signed-in users/me",
    apiPath("/api/users/me"),
    200,
    (payload) => typeof payload === "object" && payload !== null,
    { headers: authHeaders },
  );
  await expectJson(
    "Signed-in watchlist",
    apiPath("/api/watchlist"),
    200,
    (payload) => Array.isArray(payload),
    { headers: authHeaders },
  );
  console.log("Signed-in Clerk smoke checks passed.");
}

console.log("Cloudflare smoke checks passed.");