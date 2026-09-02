import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

type WorkerClient = InstanceType<typeof pg.Client> & {
  release: () => void;
};

class WorkerPool {
  constructor(private readonly connectionString: string) {}

  async query(...args: any[]): Promise<any> {
    const client = new pg.Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      return await (client.query as (...queryArgs: any[]) => Promise<any>)(...args);
    } finally {
      await client.end();
    }
  }

  async connect(): Promise<WorkerClient> {
    const client = new pg.Client({ connectionString: this.connectionString }) as WorkerClient;
    await client.connect();
    client.release = () => {
      void client.end();
    };
    return client;
  }
}

const runtimePool =
  process.env.WORKERS_RUNTIME === "1"
    ? new WorkerPool(process.env.DATABASE_URL)
    : new Pool({ connectionString: process.env.DATABASE_URL });

// Drizzle's node-postgres adapter accepts any client with Pool's query/connect
// surface. Railway keeps the native pg Pool; Workers use the adapter above so
// a suspended isolate cannot strand pooled Hyperdrive connections.
export const pool = runtimePool as InstanceType<typeof pg.Pool>;
export const db = drizzle(pool, { schema });

export * from "./schema";
export { userProfilesTable } from "./schema/profiles";
export { signalsTable } from "./schema/signals";
