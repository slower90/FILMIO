import assert from "node:assert/strict";
import test from "node:test";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

const originalWorkersRuntime = process.env.WORKERS_RUNTIME;
const originalProxyHost = process.env.CLERK_PROXY_HOST;

function restoreEnvironment() {
  if (originalWorkersRuntime === undefined) delete process.env.WORKERS_RUNTIME;
  else process.env.WORKERS_RUNTIME = originalWorkersRuntime;
  if (originalProxyHost === undefined) delete process.env.CLERK_PROXY_HOST;
  else process.env.CLERK_PROXY_HOST = originalProxyHost;
}

test("uses the configured public host for Worker Clerk proxy requests", () => {
  process.env.WORKERS_RUNTIME = "1";
  process.env.CLERK_PROXY_HOST = "filmio-3nh.pages.dev";

  try {
    assert.equal(
      getClerkProxyHost({
        headers: {
          host: "filmio-api-workers.py3912458.workers.dev",
          "x-forwarded-host": "filmio-api-workers.py3912458.workers.dev",
        },
      }),
      "filmio-3nh.pages.dev",
    );
  } finally {
    restoreEnvironment();
  }
});

test("falls back to the forwarded request host when no public host is configured", () => {
  process.env.WORKERS_RUNTIME = "1";
  delete process.env.CLERK_PROXY_HOST;

  try {
    assert.equal(
      getClerkProxyHost({
        headers: {
          host: "filmio-api-workers.py3912458.workers.dev",
          "x-forwarded-host": "filmio-api-workers.py3912458.workers.dev",
        },
      }),
      "filmio-api-workers.py3912458.workers.dev",
    );
  } finally {
    restoreEnvironment();
  }
});