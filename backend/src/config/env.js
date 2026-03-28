import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const backendDirPath = path.resolve(currentDirPath, "../..");
const projectRootEnvPath = path.resolve(backendDirPath, "../.env");
const backendEnvPath = path.resolve(backendDirPath, ".env");

dotenv.config({ path: projectRootEnvPath });
dotenv.config({ path: backendEnvPath, override: false });
dotenv.config();

const rawEnv = {
  ...process.env,
  DB_HOST: process.env.DB_HOST ?? process.env.PGHOST,
  DB_PORT: process.env.DB_PORT ?? process.env.PGPORT,
  DB_USER: process.env.DB_USER ?? process.env.PGUSER,
  DB_PASSWORD: process.env.DB_PASSWORD ?? process.env.PGPASSWORD,
  DB_NAME: process.env.DB_NAME ?? process.env.PGDATABASE,
  DB_SSL: process.env.DB_SSL ?? process.env.PGSSL,
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "require", "required"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disable", "disabled"].includes(normalized)) return false;

  return fallback;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional().default(""),
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_NAME: z.string().min(1).default("insightflow_ai"),
  DB_SSL: z.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
});

const parsed = envSchema.safeParse({
  ...rawEnv,
  DB_SSL: toBoolean(rawEnv.DB_SSL, false),
});

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed.");
}

export const env = parsed.data;

export const resolvedDatabaseConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

export const isGeminiConfigured =
  Boolean(env.GEMINI_API_KEY) &&
  !env.GEMINI_API_KEY.includes("<your_actual_key>");
