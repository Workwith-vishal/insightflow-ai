# Intercollage Competition

This document describes how the InsightFlow AI project works and provides a clear file structure reference.

## What This Project Does
InsightFlow AI is a full-stack data exploration app. Users upload a CSV dataset, get an automatic summary and chart suggestions, and then ask questions in chat to receive insights, tables, and visualizations.

## How It Works
Backend workflow
- Starts a Node HTTP server and connects to MongoDB.
- Accepts CSV uploads, parses the dataset, builds a summary, and stores it as the single "current" dataset in MongoDB.
- Serves dataset previews, summary KPIs, and chart suggestions to the frontend.
- Handles chat requests by generating answers either with Gemini (if configured) or with a deterministic fallback.
- Adds structured chart/table payloads based on the question intent and dataset characteristics.

Frontend workflow
- Provides two main routes: dashboard and upload.
- Upload page sends CSV text to the backend and refreshes the stored dataset.
- Dashboard reads dataset summary, KPIs, and chart suggestions from the backend.
- Chat UI sends user questions and receives answers, optional charts, and optional tables.
- Uses Vite dev proxy so `/api` and `/health` route to the backend during local dev.

Data flow
- CSV is uploaded as a string to the backend.
- Backend parses rows, builds column profiles, insights, KPIs, and chart suggestions.
- Dataset is stored in MongoDB under a fixed slug (`current`).
- Frontend fetches `/api/datasets/current` to render summary and preview.
- Chat requests `/api/chat` to get text answers and structured visual payloads.

## API Endpoints
- `GET /health` returns a simple status response.
- `GET /api/datasets/current` returns the current dataset summary and preview.
- `POST /api/datasets` stores a new dataset from a CSV string.
- `DELETE /api/datasets/current` clears the current dataset.
- `POST /api/chat` returns a chat answer, optional SQL, optional chart, and optional table.

## Environment Variables
Backend
- `PORT` (default `3001`)
- `CORS_ORIGIN` (default `*`)
- `MONGODB_URI` (default `mongodb://localhost:27017/insightflow-ai`)
- `GEMINI_API_KEY` (optional; enables Gemini responses)
- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_API_URL` (default Google Generative Language endpoint)

Frontend
- `VITE_API_BASE_URL` (optional; empty uses Vite proxy)
- `VITE_DEV_PROXY_TARGET` (optional; overrides proxy target)

## File Structure
```text
insightflow-ai/
  backend/
    src/
      config/
        env.js                  # Loads environment variables
      controllers/
        chatController.js       # Chat request handler
        datasetController.js    # Dataset CRUD handlers
      http/
        server.js               # HTTP server + CORS handling
      routes/
        index.js                # Route table and dispatch
      services/
        chatStructuredResponse.js # Builds chart/table payloads from intent
        datasetService.js         # Parses CSV and builds summary
        geminiService.js          # Gemini + fallback answer generation
        smartChartGenerator.ts    # Extra chart helpers
      storage/
        data/                   # Local storage artifacts (if any)
        models/
          DatasetModel.js       # Mongoose schema
        datasetStore.js         # Mongo CRUD for current dataset
        mongo.js                # Mongo connection
      utils/
        columnClassifier.ts     # Column typing helpers
        csv.js                  # CSV parsing + summary logic
        http.js                 # JSON helpers and errors
      index.js                  # Backend entry point
  frontend/
    src/
      app/
        layout/                 # App layout shell
        routes/                 # Route components
        App.tsx                 # Router + providers
      components/               # Shared UI primitives
      features/
        dashboard/              # Dashboard UI + charts
        upload/                 # Upload flow
      hooks/                    # Shared hooks
      lib/                      # Utilities and setup
      pages/                    # Page-level components
      services/                 # Client API helpers
      shared/
        data/                   # Dataset context + caching
        services/               # API client wrapper
        types/                  # Shared types
      test/                     # Frontend tests
      types/                    # App-level types
      main.tsx                  # Frontend entry point
  .env.example                  # Environment template
  package.json                  # Root scripts (dev, build, lint)
  README.md                     # Project summary
```

## Local Run Commands
From repo root:
- `npm run dev` to start frontend + backend together.
- `npm run dev:frontend` to start Vite only.
- `npm run dev:backend` to start the Node backend only.

## Notes on Chat Behavior
- If `GEMINI_API_KEY` is not set, the backend returns a deterministic fallback using dataset summaries.
- Chart/table payloads are inferred from the question and dataset schema to keep answers structured.
