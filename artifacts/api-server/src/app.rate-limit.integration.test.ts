import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { after, test } from "node:test";
import { pool } from "@workspace/db";

const serverCount = 2;
const publicLimit = 6;
const authLimit = 4;
const requestCount = 12;

type RunningServer = {
  process: ChildProcess;
  url: string;
};

after(async () => {
  await pool.end();
});

async function waitForServer(url: string, probeIp: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (
        (
          await fetch(`${url}/api/healthz`, {
            headers: { "x-forwarded-for": probeIp },
          })
        ).ok
      ) {
        return;
      }
    } catch {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not become ready at ${url}`);
}

async function startServer(
  port: number,
  publicRateLimit: number,
): Promise<RunningServer> {
  const child = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      LOG_LEVEL: "silent",
      RATE_LIMIT_PUBLIC_PER_MINUTE: String(publicRateLimit),
      RATE_LIMIT_AUTH_MUTATION_PER_MINUTE: String(authLimit),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url, `192.0.2.${port - 31_000}`);
  return { process: child, url };
}

async function stopServer(server: RunningServer): Promise<void> {
  if (server.process.exitCode !== null) return;
  server.process.kill("SIGTERM");
  await Promise.race([
    once(server.process, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (server.process.exitCode === null) server.process.kill("SIGKILL");
}

test(
  "shares authenticated mutation limits and 429 headers across server processes",
  { timeout: 30_000 },
  async () => {
    const identity = `rate-limit-integration-${process.pid}`;
    const bucketKey = `user-mutation:${identity}`;
    await pool.query(
      "CREATE TABLE IF NOT EXISTS api_rate_limit_windows (bucket_key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, request_count INTEGER NOT NULL)",
    );
    await pool.query("DELETE FROM api_rate_limit_windows WHERE bucket_key = $1", [
      bucketKey,
    ]);

    const servers: RunningServer[] = [];
    try {
      for (let index = 0; index < serverCount; index++) {
        servers.push(await startServer(31_000 + index, 100));
      }

      const responses = await Promise.all(
        Array.from({ length: requestCount }, (_, index) => {
          const server = servers[index % servers.length];
          return fetch(`${server.url}/api/ratings`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-user": identity,
            },
            body: JSON.stringify({ movieId: 10_000 + index, score: 7 }),
          });
        }),
      );

      const rejected = responses.filter((response) => response.status === 429);
      assert.equal(
        rejected.length,
        requestCount - authLimit,
        "both processes must count against one authenticated window",
      );
      assert.equal(
        responses.filter((response) => response.status !== 429).length,
        authLimit,
      );

      for (const response of rejected) {
        assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
        assert.equal(response.headers.get("x-ratelimit-limit"), String(authLimit));
        assert.match(response.headers.get("x-ratelimit-remaining") ?? "", /^0$/);
        assert.match(response.headers.get("x-ratelimit-reset") ?? "", /^\d+$/);
      }
    } finally {
      await Promise.all(servers.map(stopServer));
      await pool.query("DELETE FROM api_rate_limit_windows WHERE bucket_key = $1", [
        bucketKey,
      ]);
    }
  },
);


test(
  "shares public IP limits and 429 headers across server processes",
  { timeout: 30_000 },
  async () => {
    const syntheticIp = "198.51.100.62";
    const bucketKey = `ip:${syntheticIp}`;
    await pool.query(
      "CREATE TABLE IF NOT EXISTS api_rate_limit_windows (bucket_key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, request_count INTEGER NOT NULL)",
    );
    await pool.query("DELETE FROM api_rate_limit_windows WHERE bucket_key = $1", [
      bucketKey,
    ]);

    const servers: RunningServer[] = [];
    try {
      for (let index = 0; index < serverCount; index++) {
        servers.push(await startServer(31_010 + index, publicLimit));
      }

      const responses = await Promise.all(
        Array.from({ length: requestCount }, (_, index) => {
          const server = servers[index % servers.length];
          return fetch(`${server.url}/api/healthz`, {
            headers: {
              "x-forwarded-for": syntheticIp,
            },
          });
        }),
      );

      const rejected = responses.filter((response) => response.status === 429);
      assert.equal(
        rejected.length,
        requestCount - publicLimit,
        "both processes must count against one public IP window",
      );
      assert.equal(
        responses.filter((response) => response.status !== 429).length,
        publicLimit,
      );

      for (const response of rejected) {
        assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
        assert.equal(
          response.headers.get("x-ratelimit-limit"),
          String(publicLimit),
        );
        assert.match(response.headers.get("x-ratelimit-remaining") ?? "", /^0$/);
        assert.match(response.headers.get("x-ratelimit-reset") ?? "", /^\d+$/);
      }
    } finally {
      await Promise.all(servers.map(stopServer));
      await pool.query("DELETE FROM api_rate_limit_windows WHERE bucket_key = $1", [
        bucketKey,
      ]);
    }
  },
);