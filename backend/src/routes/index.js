import {
  deleteCurrentDatasetController,
  getCurrentDatasetController,
  uploadDatasetController,
} from "../controllers/datasetController.js";
import { chatController } from "../controllers/chatController.js";
import { json, methodNotAllowed, notFound } from "../utils/http.js";

const routes = [
  {
    method: "GET",
    path: "/health",
    handler: async (_req, res) => {
      json(res, 200, { status: "ok" });
    },
  },
  {
    method: "GET",
    path: "/api/datasets/current",
    handler: getCurrentDatasetController,
  },
  {
    method: "POST",
    path: "/api/datasets",
    handler: uploadDatasetController,
  },
  {
    method: "DELETE",
    path: "/api/datasets/current",
    handler: deleteCurrentDatasetController,
  },
  {
    method: "POST",
    path: "/api/chat",
    handler: chatController,
  },
];

export const handleRoute = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const matchingPathRoutes = routes.filter((route) => route.path === url.pathname);

  if (matchingPathRoutes.length === 0) {
    notFound(res);
    return;
  }

  const route = matchingPathRoutes.find((candidate) => candidate.method === req.method);
  if (!route) {
    methodNotAllowed(
      res,
      matchingPathRoutes.map((candidate) => candidate.method),
    );
    return;
  }

  await route.handler(req, res);
};
