import { Client } from "pg";

type HyperdriveBinding = {
  connectionString: string;
};

type WorkerEnv = {
  HYPERDRIVE: HyperdriveBinding;
};

type WorkerRequest = {
  method: string;
  url: string;
};

type WorkerResponseInit = {
  status?: number;
  headers?: Record<string, string>;
};

declare class Response {
  constructor(body?: string, init?: WorkerResponseInit);
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/health") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
    });
    const startedAt = Date.now();

    try {
      await client.connect();
      const result = await client.query<{ connected: number }>(
        "SELECT 1 AS connected",
      );
      const connected = result.rows[0]?.connected === 1;

      return jsonResponse({
        status: connected ? "ok" : "error",
        database: connected ? "connected" : "unexpected_result",
        query: "SELECT 1",
        latencyMs: Date.now() - startedAt,
      }, connected ? 200 : 503);
    } catch {
      return jsonResponse(
        {
          status: "error",
          database: "unavailable",
          query: "SELECT 1",
        },
        503,
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  },
} satisfies {
  fetch(request: WorkerRequest, env: WorkerEnv): Promise<Response>;
};