import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import { env } from "cloudflare:workers";

type HyperdriveBinding = {
  connectionString: string;
};

type WorkerBindings = {
  HYPERDRIVE: HyperdriveBinding;
  [key: string]: unknown;
};

const processEnvKeys = [
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_PROXY_HOST",
  "TMDB_API_KEY",
  "OMDB_API_KEY",
  "YOUTUBE_API_KEY",
  "MEILISEARCH_HOST",
  "MEILISEARCH_API_KEY",
  "SESSION_SECRET",
  "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
  "PRIVATE_OBJECT_DIR",
  "PUBLIC_OBJECT_SEARCH_PATHS",
  "FILMIO_ADMIN_CLERK_USER_IDS",
  "CATALOG_FALLBACK_API_KEY",
  "CATALOG_FALLBACK_ATTRIBUTION",
  "CATALOG_FALLBACK_BASE_URL",
  "CATALOG_FALLBACK_NAME",
  "CATALOG_FALLBACK_QUOTA",
  "FREE_CLASSICS_YOUTUBE_CATALOG",
  "FREE_CLASSICS_YOUTUBE_CHANNEL_IDS",
  "MANAGED_UPCOMING_MOVIE_TITLES",
  "VAST_AD_TAG_URL",
  "VVAAN_POSTER_URL",
  "VVAAN_RELEASE_DATE",
] as const;

let initialization: Promise<void> | null = null;

async function initializeWorker(bindings: WorkerBindings): Promise<void> {
  const connectionString = bindings.HYPERDRIVE?.connectionString;
  if (!connectionString) {
    throw new Error("HYPERDRIVE binding is required");
  }

  // The existing Node entrypoint reads configuration at module evaluation
  // time. Seed process.env before importing the Express app so the same route
  // modules can run under Workers without changing Railway's bootstrap.
  process.env.DATABASE_URL = connectionString;
  process.env.WORKERS_RUNTIME = "1";
  for (const key of processEnvKeys) {
    const value = bindings[key];
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }

  const { default: app } = await import("./app");
  const server = createServer(app);
  server.listen(3000);
}

async function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = initializeWorker(env as unknown as WorkerBindings).catch((error) => {
      console.error("FILMIO Worker initialization failed", error);
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      await ensureInitialized();
      return handleAsNodeRequest(3000, request);
    } catch (error) {
      console.error("FILMIO Worker request failed", error);
      return new Response(JSON.stringify({ error: "Worker initialization failed" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
  },
};