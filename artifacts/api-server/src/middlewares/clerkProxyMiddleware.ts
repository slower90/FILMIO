/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import type { IncomingHttpHeaders } from 'http';
import type { Request as ExpressRequest, RequestHandler } from 'express';
import { isDevelopmentFromSecretKey } from '@clerk/shared/keys';
import { createProxyMiddleware } from 'http-proxy-middleware';

const CLERK_FAPI = 'https://frontend-api.clerk.dev';
export const CLERK_PROXY_PATH = '/api/__clerk';

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 * In the multi-value case, the leftmost value is the original client-
 * facing host. Take that one in all forms. Exported so that app.ts
 * (clerkMiddleware callback) and this proxy middleware agree on which
 * hostname is canonical — otherwise multi-domain/custom-domain flows
 * break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  // A Workers request is received on the workers.dev hostname, but Clerk
  // validates the proxy against the public frontend hostname. Keep this
  // explicit so the Worker can serve the same Clerk instance as Pages.
  if (process.env.WORKERS_RUNTIME === "1") {
    const configuredHost = process.env.CLERK_PROXY_HOST?.trim();
    if (configuredHost) {
      try {
        const parsed = new URL(
          configuredHost.includes("://")
            ? configuredHost
            : `https://${configuredHost}`,
        );
        return parsed.hostname;
      } catch {
        // Fall through to the request host rather than sending an invalid
        // Clerk-Proxy-Url header.
      }
    }
  }

  const forwarded = req.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(',')[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

type WorkerRequest = ExpressRequest & {
  originalUrl?: string;
  on: (event: string, listener: (...args: any[]) => void) => void;
};

async function readNodeRequestBody(req: WorkerRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function workerClerkProxyMiddleware(secretKey: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const workerRequest = req as WorkerRequest;
      const originalUrl = workerRequest.originalUrl ?? req.url;
      const upstreamPath = originalUrl.startsWith(CLERK_PROXY_PATH)
        ? originalUrl.slice(CLERK_PROXY_PATH.length) || "/"
        : req.url || "/";
      const protocol = req.header("x-forwarded-proto") || "https";
      const host = getClerkProxyHost(req) || "";
      const forwardedFor = req.header("x-forwarded-for") || req.ip || "";
      const headers = new Headers();

      for (const [name, value] of Object.entries(req.headers)) {
        if (["connection", "content-length", "host", "transfer-encoding"].includes(name)) continue;
        if (value !== undefined) {
          headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
      }
      headers.set("Clerk-Proxy-Url", `${protocol}://${host}${CLERK_PROXY_PATH}`);
      headers.set("Clerk-Secret-Key", secretKey);
      if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor.split(",")[0].trim());

      const method = req.method.toUpperCase();
      const body = ["GET", "HEAD"].includes(method)
        ? undefined
        : await readNodeRequestBody(workerRequest);
      const upstream = await fetch(`${CLERK_FAPI}${upstreamPath}`, {
        method,
        headers,
        body,
      });

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, name) => {
        if (!["connection", "keep-alive", "transfer-encoding"].includes(name)) {
          res.setHeader(name, value);
        }
      });
      if (method === "HEAD" || upstream.status === 204) {
        res.end();
        return;
      }
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
}

export function clerkProxyMiddleware(): RequestHandler {
  if (process.env.WORKERS_RUNTIME === "1") {
    const secretKey = process.env.CLERK_SECRET_KEY;
    // Replit-managed development keys talk to Clerk's development FAPI
    // directly. Proxying them through a workers.dev host causes Clerk to
    // return host_invalid and is not needed for local/test instances.
    if (!secretKey || isDevelopmentFromSecretKey(secretKey)) {
      return (_req, _res, next) => next();
    }
    return workerClerkProxyMiddleware(secretKey);
  }

  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== 'production') {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || isDevelopmentFromSecretKey(secretKey)) {
    return (_req, _res, next) => next();
  }

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    // Take over the response so it can be re-sent with a Content-Length (see
    // proxyRes); the deployment edge rejects chunked proxied responses.
    selfHandleResponse: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ''),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = getClerkProxyHost(req) || '';
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader('Clerk-Proxy-Url', proxyUrl);
        proxyReq.setHeader('Clerk-Secret-Key', secretKey);

        const xff = req.headers['x-forwarded-for'];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          '';
        if (clientIp) {
          proxyReq.setHeader('X-Forwarded-For', clientIp);
        }
      },
      // Clerk's dynamic Frontend API responses (/v1/environment, /v1/client,
      // JWKS, ...) arrive without a Content-Length, so relaying them would use
      // Transfer-Encoding: chunked — which the deployment edge (Cloud Run)
      // rejects, turning the app's 200 into a 500. Buffer only those so they can
      // be re-sent with a Content-Length; the body is forwarded untouched so
      // Content-Encoding is preserved. Length-known responses (e.g. /npm/*
      // assets) and body-less responses stream through without buffering.
      proxyRes: (proxyRes, req, res) => {
        const headers = { ...proxyRes.headers };
        // Transfer-Encoding/Connection are hop-by-hop (RFC 7230 §6.1).
        delete headers['transfer-encoding'];
        delete headers['connection'];
        delete headers['keep-alive'];

        const status = proxyRes.statusCode ?? 502;
        // Content-Length is forbidden on 1xx/204; HEAD/304 may keep theirs.
        if (status < 200 || status === 204) {
          delete headers['content-length'];
        }

        const bodyless =
          req.method === 'HEAD' ||
          status < 200 ||
          status === 204 ||
          status === 304;
        if (headers['content-length'] !== undefined || bodyless) {
          res.writeHead(status, headers);
          // Headers are already sent, so abort the response if the upstream
          // stream errors mid-pipe (e.g. ECONNRESET) rather than leaving an
          // unhandled 'error' or a hung client.
          proxyRes.on('error', () => res.destroy());
          proxyRes.pipe(res);
          return;
        }

        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          headers['content-length'] = String(body.length);
          res.writeHead(status, headers);
          res.end(body);
        });
        proxyRes.on('error', () => {
          if (!res.headersSent) {
            // Set a length so the empty 502 isn't sent chunked (which the
            // deployment edge would reject just like the original response).
            res.writeHead(502, { 'content-length': '0' });
          }
          res.end();
        });
      },
    },
  }) as RequestHandler;
}
