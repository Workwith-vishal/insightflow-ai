import http from "node:http";
import { env } from "../config/env.js";
import { handleRoute } from "../routes/index.js";
import { json, sendEmpty } from "../utils/http.js";

const resolveAllowedOrigin = (origin) => {
  if (!origin) return "*";
  if (env.corsOrigin === "*") return origin;

  const allowedOrigins = env.corsOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";
};

const setCorsHeaders = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", resolveAllowedOrigin(req.headers.origin));
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
};

export const createServer = () =>
  http.createServer(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }

    try {
      await handleRoute(req, res);
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      });
    }
  });
