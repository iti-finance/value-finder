import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getServerConfig } from "@/lib/config.server";

const config = getServerConfig();

/**
 * PostgreSQL Connection Pool
 */
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let schemaReadyPromise: Promise<void> | null = null;

/**
 * Apply small, backward-compatible schema additions for existing deployments.
 * db-init.sql only runs when PostgreSQL creates a brand-new data volume, so
 * this keeps long-lived server volumes compatible with newer application code.
 */
async function ensureDatabaseSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool
      .query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation varchar(120)`)
      .then(() => undefined)
      .catch((error) => {
        schemaReadyPromise = null;
        throw error;
      });
  }

  await schemaReadyPromise;
}

/**
 * Verify database connection during application startup.
 */
(async () => {
  try {
    const client: PoolClient = await pool.connect();
    console.log("Connected to PostgreSQL");
    client.release();
  } catch (error) {
    console.error("Unable to connect to PostgreSQL");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
})();

/**
 * Database Helper
 */
export const db = {
  query: async <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> => {
    await ensureDatabaseSchema();
    return pool.query<T>(text, params);
  },

  withTransaction: async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    await ensureDatabaseSchema();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
