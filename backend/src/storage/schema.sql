CREATE TABLE IF NOT EXISTS datasets (
  id SERIAL PRIMARY KEY,
  "fileName" VARCHAR(255) NOT NULL,
  "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  headers JSON NOT NULL DEFAULT '[]',
  rows JSON NOT NULL DEFAULT '[]',
  "totalRows" INTEGER NOT NULL,
  "previewRows" JSON NOT NULL DEFAULT '[]',
  summary JSON NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  "datasetId" INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  answer TEXT,
  sql TEXT,
  insights JSON NOT NULL DEFAULT '[]',
  chart JSON,
  source VARCHAR(50) NOT NULL DEFAULT 'gemini',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS datasets_uploaded_at_idx ON datasets ("uploadedAt" DESC);
CREATE INDEX IF NOT EXISTS datasets_created_at_idx ON datasets ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS chat_messages_dataset_id_idx ON chat_messages ("datasetId");
CREATE INDEX IF NOT EXISTS chat_messages_dataset_created_at_idx
  ON chat_messages ("datasetId", "createdAt" DESC);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS datasets_set_updated_at ON datasets;

CREATE TRIGGER datasets_set_updated_at
BEFORE UPDATE ON datasets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
