import { query } from "../storage/database.js";

const toChatMessageRecord = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    datasetId: row.datasetId,
    message: row.message,
    answer: row.answer ?? "",
    sql: row.sql ?? "",
    insights: Array.isArray(row.insights) ? row.insights : [],
    chart: row.chart ?? null,
    source: row.source ?? "gemini",
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
};

export const saveChatMessage = async (
  datasetId,
  message,
  answer,
  sql,
  insights,
  chart,
  source = "gemini",
  client,
) => {
  const result = await query(
    `INSERT INTO chat_messages (
      "datasetId",
      message,
      answer,
      sql,
      insights,
      chart,
      source
    ) VALUES ($1, $2, $3, $4, $5::json, $6::json, $7)
    RETURNING
      id,
      "datasetId",
      message,
      answer,
      sql,
      insights,
      chart,
      source,
      "createdAt"`,
    [
      datasetId,
      message,
      answer ?? "",
      sql ?? "",
      JSON.stringify(Array.isArray(insights) ? insights : []),
      chart ? JSON.stringify(chart) : null,
      source,
    ],
    client,
  );

  return toChatMessageRecord(result.rows[0]);
};

export const getChatHistory = async (datasetId, client) => {
  const result = await query(
    `SELECT
      id,
      "datasetId",
      message,
      answer,
      sql,
      insights,
      chart,
      source,
      "createdAt"
     FROM chat_messages
     WHERE "datasetId" = $1
     ORDER BY "createdAt" ASC, id ASC`,
    [datasetId],
    client,
  );

  return result.rows.map(toChatMessageRecord);
};

export const deleteChatHistory = async (datasetId, client) => {
  const result = await query(
    `DELETE FROM chat_messages
     WHERE "datasetId" = $1`,
    [datasetId],
    client,
  );

  return {
    success: true,
    deletedCount: result.rowCount ?? 0,
  };
};
