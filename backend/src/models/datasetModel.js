import { query } from "../storage/database.js";

const defaultSummary = {
  rowCount: 0,
  columnCount: 0,
  columns: [],
  kpis: [],
  insights: [],
  chartSuggestions: [],
};

const normalizeRowValue = (value) => (value === undefined || value === null ? "" : value);

const normalizeHeaders = (headers) =>
  Array.isArray(headers) ? headers.map((header) => String(header)) : [];

const buildRowsFromRecords = (records, headers) => {
  if (!Array.isArray(records)) return [];

  return records.map((record) =>
    headers.map((header) => normalizeRowValue(record?.[header])),
  );
};

const buildRecordsFromRows = (rows, headers) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, normalizeRowValue(row?.[index])]),
    ),
  );
};

const normalizeDatasetPayload = (data = {}) => {
  const headers = normalizeHeaders(data.headers);
  const rows = Array.isArray(data.rows) ? data.rows : buildRowsFromRecords(data.records, headers);
  const previewRows = Array.isArray(data.previewRows) ? data.previewRows : rows.slice(0, 100);

  return {
    fileName: String(data.fileName ?? ""),
    uploadedAt: data.uploadedAt ? new Date(data.uploadedAt) : new Date(),
    headers,
    rows,
    totalRows: Number(data.totalRows ?? rows.length),
    previewRows,
    summary: data.summary ?? defaultSummary,
  };
};

const toDatasetRecord = (row) => {
  if (!row) return null;

  const headers = normalizeHeaders(row.headers);
  const datasetRows = Array.isArray(row.rows) ? row.rows : [];

  return {
    id: row.id,
    fileName: row.fileName,
    uploadedAt:
      row.uploadedAt instanceof Date ? row.uploadedAt.toISOString() : String(row.uploadedAt),
    headers,
    rows: datasetRows,
    totalRows: Number(row.totalRows ?? datasetRows.length),
    previewRows: Array.isArray(row.previewRows) ? row.previewRows : [],
    records: buildRecordsFromRows(datasetRows, headers),
    summary: row.summary ?? defaultSummary,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
};

export const createDataset = async (data, client) => {
  const payload = normalizeDatasetPayload(data);
  const result = await query(
    `INSERT INTO datasets (
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary
    ) VALUES ($1, $2, $3::json, $4::json, $5, $6::json, $7::json)
    RETURNING
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"`,
    [
      payload.fileName,
      payload.uploadedAt,
      JSON.stringify(payload.headers),
      JSON.stringify(payload.rows),
      payload.totalRows,
      JSON.stringify(payload.previewRows),
      JSON.stringify(payload.summary),
    ],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getDataset = async (id, client) => {
  const result = await query(
    `SELECT
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"
     FROM datasets
     WHERE id = $1`,
    [id],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getCurrentDataset = async (client) => {
  const result = await query(
    `SELECT
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"
     FROM datasets
     ORDER BY "uploadedAt" DESC, id DESC
     LIMIT 1`,
    [],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const updateDataset = async (id, data, client) => {
  const current = await getDataset(id, client);
  if (!current) return null;

  const payload = normalizeDatasetPayload({ ...current, ...data });
  const result = await query(
    `UPDATE datasets
     SET
      "fileName" = $2,
      "uploadedAt" = $3,
      headers = $4::json,
      rows = $5::json,
      "totalRows" = $6,
      "previewRows" = $7::json,
      summary = $8::json
     WHERE id = $1
     RETURNING
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"`,
    [
      id,
      payload.fileName,
      payload.uploadedAt,
      JSON.stringify(payload.headers),
      JSON.stringify(payload.rows),
      payload.totalRows,
      JSON.stringify(payload.previewRows),
      JSON.stringify(payload.summary),
    ],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const deleteDataset = async (id, client) => {
  const result = await query(
    `DELETE FROM datasets
     WHERE id = $1
     RETURNING
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"`,
    [id],
    client,
  );

  return toDatasetRecord(result.rows[0]);
};

export const getAllDatasets = async (client) => {
  const result = await query(
    `SELECT
      id,
      "fileName",
      "uploadedAt",
      headers,
      rows,
      "totalRows",
      "previewRows",
      summary,
      "createdAt",
      "updatedAt"
     FROM datasets
     ORDER BY "uploadedAt" DESC, id DESC`,
    [],
    client,
  );

  return result.rows.map(toDatasetRecord);
};
