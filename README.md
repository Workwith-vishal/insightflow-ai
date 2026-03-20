# InsightFlow AI

## Project structure

`frontend/` contains the React + Vite application.

`backend/` contains the Node API for dataset upload, persistence, summarization, and chat analysis.

## Frontend structure

`frontend/src/app` contains routing and layout.

`frontend/src/features` contains feature modules such as chat, dashboard, and upload.

`frontend/src/shared` contains reusable hooks, services, types, and utility helpers.

`frontend/src/components/ui` contains the shared shadcn UI layer.

## Top-level commands

`npm run dev:frontend`

`npm run build:frontend`

`npm run dev:backend`

## Environment

Use [.env.example](c:/Users/VISHAL/Desktop/20-12-2025/All_full_stack_preparation/New%20folder/insightflow-ai/.env.example) as the starting point.

Backend variables:

- `PORT`
- `CORS_ORIGIN`
- `MONGODB_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Frontend variables:

- `VITE_API_BASE_URL`

## API routes

- `GET /health`
- `POST /api/datasets`
- `GET /api/datasets/current`
- `DELETE /api/datasets/current`
- `POST /api/chat`

If `GEMINI_API_KEY` is missing, the backend still works and returns deterministic fallback analysis based on dataset summaries.

For local development, leave `VITE_API_BASE_URL` empty so frontend requests go through the Vite proxy and avoid LAN CORS issues.
