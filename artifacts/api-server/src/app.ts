import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { pool } from "@workspace/db";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { logger } from "./lib/logger";
import router from "./routes";

const app: Express = express();

const RATE_WINDOW_MS = 60_000;
function configuredLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

const PUBLIC_RATE_LIMIT = configuredLimit("RATE_LIMIT_PUBLIC_PER_MINUTE", 180);
const AUTH_MUTATION_RATE_LIMIT = configuredLimit(
  "RATE_LIMIT_AUTH_MUTATION_PER_MINUTE",
  30,
);
const limiterTableReady = pool
  .query(
    `
  CREATE TABLE IF NOT EXISTS api_rate_limit_windows (
    bucket_key TEXT PRIMARY KEY,
    window_start BIGINT NOT NULL,
    request_count INTEGER NOT NULL
  )
`,
  )
  .then(() => true);
let cleanupCounter = 0;

function clientAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isMutation(req: Request): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(req.method);
}

function authenticatedUserId(req: Request): string | null {
  // Integration tests use synthetic identities because they exercise the
  // limiter, not Clerk token verification. This branch is unreachable outside
  // the test environment and never accepts a caller-controlled identity in
  // development or production.
  if (process.env.NODE_ENV === "test") {
    return req.header("x-test-user") ?? null;
  }
  try {
    return getAuth(req).userId ?? null;
  } catch {
    return null;
  }
}

type LimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: number;
};

async function consumeSharedLimit(
  bucketKey: string,
  limit: number,
  now: number,
): Promise<LimitResult> {
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const result = await pool.query<{
    request_count: number;
    window_start: string;
  }>(
    `
    INSERT INTO api_rate_limit_windows (bucket_key, window_start, request_count)
    VALUES ($1, $2, 1)
    ON CONFLICT (bucket_key) DO UPDATE SET
      window_start = EXCLUDED.window_start,
      request_count = CASE
        WHEN api_rate_limit_windows.window_start = EXCLUDED.window_start
          THEN api_rate_limit_windows.request_count + 1
        ELSE 1
      END
    RETURNING request_count, window_start
  `,
    [bucketKey, windowStart],
  );
  const row = result.rows[0];
  const resetAt = Number(row.window_start) + RATE_WINDOW_MS;
  return {
    allowed: row.request_count <= limit,
    count: row.request_count,
    limit,
    resetAt,
  };
}

async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const now = Date.now();
  const userId = authenticatedUserId(req);
  const publicKey = `ip:${clientAddress(req)}`;
  const limits = [{ key: publicKey, limit: PUBLIC_RATE_LIMIT }];
  if (userId && isMutation(req)) {
    limits.push({
      key: `user-mutation:${userId}`,
      limit: AUTH_MUTATION_RATE_LIMIT,
    });
  }

  try {
    await limiterTableReady;
    const results = await Promise.all(
      limits.map(({ key, limit }) => consumeSharedLimit(key, limit, now)),
    );
    const blocked = results.find((result) => !result.allowed);
    const headerLimit = Math.min(...results.map((result) => result.limit));
    const headerRemaining = Math.max(
      0,
      Math.min(...results.map((result) => result.limit - result.count)),
    );
    const resetAt = Math.max(...results.map((result) => result.resetAt));
    res.setHeader("X-RateLimit-Limit", headerLimit);
    res.setHeader("X-RateLimit-Remaining", headerRemaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000));

    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((blocked.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter);
      logger.warn(
        {
          event: "rate_limit_exceeded",
          method: req.method,
          route: req.path,
          scope:
            userId && isMutation(req) ? "authenticated_mutation" : "public",
          retryAfterSeconds: retryAfter,
        },
        "Request rate limit exceeded",
      );
      res.status(429).json({
        error: "Too many requests. Please try again shortly.",
        retryAfterSeconds: retryAfter,
      });
      return;
    }
    if (++cleanupCounter % 1000 === 0) {
      void pool
        .query("DELETE FROM api_rate_limit_windows WHERE window_start < $1", [
          now - RATE_WINDOW_MS * 2,
        ])
        .catch((err) => logger.warn({ err }, "Rate limit cleanup failed"));
    }
    next();
  } catch (err) {
    logger.error({ err }, "Shared rate limiter unavailable");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Retry-After", "5");
      res.status(503).json({
        error:
          "Traffic protection is temporarily unavailable. Please retry shortly.",
      });
      return;
    }
    // Local development can continue using the route handlers when no database
    // is available; production fails closed rather than silently going local.
    next();
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const request = (origin as string).trim();
      // CORS callback does not receive req in the cors package, so configured
      // origins are authoritative; same-origin requests do not need CORS.
      const configured = (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
      const expoDomain = process.env.REPLIT_EXPO_DEV_DOMAIN?.trim();
      const developmentOrigins = [
        devDomain ? `https://${devDomain}` : "",
        expoDomain ? `https://${expoDomain}` : "",
        devDomain?.replace(".pike.replit.dev", ".expo.pike.replit.dev") ?? "",
      ].filter(Boolean);
      if (
        configured.includes(request) ||
        developmentOrigins.includes(request) ||
        /^https?:\/\/localhost(?::\d+)?$/.test(request)
      ) {
        callback(null, request);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
// Encrypted attachment payloads are base64 encoded client-side. This limit
// accommodates an 8 MB attachment without ever parsing plaintext server-side.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use(rateLimit);
app.use("/api", router);

app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (err?.message === "Origin is not allowed by CORS") {
    res.status(403).json({ error: "Origin is not allowed." });
    return;
  }
  logger.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error." });
});

export default app;
