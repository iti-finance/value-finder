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

/**
 * Verify database connection during application startup.
 */
(async () => {
  try {
    const client: PoolClient = await pool.connect();
    console.log("✅ Connected to PostgreSQL");
    client.release();
  } catch (error) {
    console.error("❌ Unable to connect to PostgreSQL");

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
    return pool.query<T>(text, params);
  },
};
