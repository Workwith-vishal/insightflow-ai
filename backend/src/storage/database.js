import pg from "pg";
import { env, resolvedDatabaseConfig } from "../config/env.js";

const { Pool } = pg;

let pool;
let connectionPromise;

const createPool = () => {
  const instance = new Pool({
    ...resolvedDatabaseConfig,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: env.NODE_ENV !== "production",
  });

  instance.on("connect", () => {
    console.info("[postgres] client connected");
  });

  instance.on("error", (error) => {
    console.error("[postgres] unexpected pool error", error);
  });

  instance.on("remove", () => {
    console.info("[postgres] client removed from pool");
  });

  return instance;
};

export const getPool = () => {
  if (!pool) {
    pool = createPool();
  }

  return pool;
};

export const connectToDatabase = async () => {
  if (connectionPromise) {
    return connectionPromise;
  }

  const activePool = getPool();

  connectionPromise = activePool
    .query("SELECT NOW() AS connected_at")
    .then(({ rows }) => {
      const connectedAt = rows[0]?.connected_at;
      console.info(`[postgres] pool ready at ${connectedAt?.toISOString?.() ?? connectedAt}`);
      return activePool;
    })
    .catch((error) => {
      connectionPromise = undefined;
      console.error("[postgres] connection failed", error);
      throw error;
    });

  return connectionPromise;
};

export const query = async (text, params = [], client) => {
  const executor = client ?? (await connectToDatabase());
  return executor.query(text, params);
};

export const withTransaction = async (callback) => {
  const activePool = await connectToDatabase();
  const client = await activePool.connect();

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
};

export const checkDatabaseHealth = async () => {
  const activePool = await connectToDatabase();
  const result = await activePool.query(
    `SELECT
      NOW() AS checked_at,
      COUNT(*)::int AS total_connections
     FROM pg_stat_activity
     WHERE datname = current_database()`,
  );

  return {
    ok: true,
    checkedAt: result.rows[0]?.checked_at ?? null,
    totalConnections: result.rows[0]?.total_connections ?? 0,
  };
};

export const closeDatabase = async () => {
  if (!pool) return;

  const activePool = pool;
  pool = undefined;
  connectionPromise = undefined;
  await activePool.end();
  console.info("[postgres] pool closed");
};
