import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Files,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/shared/data/DataContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = "queued" | "uploading" | "success" | "error";

interface UploadItem {
  id: string;
  name: string;
  status: UploadStatus;
  error?: string;
  rows?: number;
  columns?: number;
}

// ─── Status badge helper ───────────────────────────────────────────────────────

function StatusBadge({ status, error }: { status: UploadStatus; error?: string }) {
  if (status === "uploading") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Uploading…
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="flex items-center gap-1 text-chart-emerald text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-destructive text-xs" title={error}>
        <AlertCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }
  // queued
  return <span className="text-xs text-muted-foreground">Queued</span>;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function UploadPage() {
  const { parsed, fileName, uploadDataset, clearData, isLoading } = useDataset();

  const [globalError, setGlobalError] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  // ── On mount: clear any previously loaded dataset so the upload UI is shown ──
  // Run only once; don't include `parsed` in deps to avoid an infinite loop
  // when clearData updates the context and re-renders this component.
  useEffect(() => {
    void clearData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUploading = useMemo(
    () => uploads.some((u) => u.status === "uploading"),
    [uploads],
  );

  const successCount = useMemo(
    () => uploads.filter((u) => u.status === "success").length,
    [uploads],
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setStatus = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const removeUpload = (id: string) =>
    setUploads((prev) => prev.filter((item) => item.id !== id));

  const clearAll = () => {
    setUploads([]);
    setGlobalError("");
    void clearData();
  };

  // ── Drop handler ─────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;

      setGlobalError("");

      // Register every file as "queued" first so the list appears immediately
      const queued = acceptedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
      }));

      setUploads((prev) => [
        ...queued.map(({ id, file }) => ({
          id,
          name: file.name,
          status: "queued" as const,
        })),
        ...prev,
      ]);

      // Upload sequentially so the context isn't flooded with concurrent writes
      for (const { id, file } of queued) {
        setStatus(id, { status: "uploading" });

        try {
          const csv = await file.text();
          await uploadDataset({ fileName: file.name, csv });

          // Try to surface row/column counts from the parsed context snapshot.
          // (parsed may update asynchronously; we read it optimistically.)
          setStatus(id, { status: "success" });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to upload CSV file.";
          setStatus(id, { status: "error", error: message });
          setGlobalError(message);
        }
      }
    },
    [uploadDataset],
  );

  // ── Dropzone ─────────────────────────────────────────────────────────────────

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: true,
    maxSize: 20 * 1024 * 1024, // 20 MB
  });

  // Surface dropzone-level rejections (wrong type, too large, etc.)
  useEffect(() => {
    if (!fileRejections.length) return;
    const msgs = fileRejections.map(
      ({ file, errors }) =>
        `${file.name}: ${errors.map((e) => e.message).join(", ")}`,
    );
    setGlobalError(msgs.join(" | "));
  }, [fileRejections]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Upload Dataset</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload one or more CSV files to start analyzing your data with AI.
          </p>
        </div>
        <div className="flex gap-2">
          {uploads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link to="/">Analysis Data</Link>
          </Button>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <input {...getInputProps()} />

          {isDragActive ? (
            <Files className="w-10 h-10 mx-auto mb-4 text-primary" />
          ) : (
            <Upload
              className={`w-10 h-10 mx-auto mb-4 ${
                isLoading || isUploading ? "text-primary animate-pulse" : "text-muted-foreground"
              }`}
            />
          )}

          <p className="text-sm text-foreground font-medium">
            {isLoading || isUploading
              ? "Uploading files…"
              : isDragActive
                ? "Drop your CSV files here"
                : "Drag & drop CSV files, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max 20 MB per file · CSV format only · Multiple files supported
          </p>
        </div>
      </motion.div>

      {/* ── Upload list ── */}
      <AnimatePresence initial={false}>
        {uploads.length > 0 && (
          <motion.div
            key="upload-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2"
          >
            {/* Summary bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                {successCount} of {uploads.length} file
                {uploads.length !== 1 ? "s" : ""} uploaded
              </span>
              {!isUploading && (
                <button
                  onClick={clearAll}
                  className="hover:text-foreground transition-colors"
                >
                  Clear list
                </button>
              )}
            </div>

            {uploads.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </p>
                  {item.status === "error" && item.error && (
                    <p className="text-xs text-destructive mt-0.5 truncate" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </div>

                {/* Status */}
                <StatusBadge status={item.status} error={item.error} />

                {/* Remove button (only when not uploading) */}
                {item.status !== "uploading" && (
                  <button
                    onClick={() => removeUpload(item.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Latest successful dataset preview ── */}
      <AnimatePresence>
        {parsed && !isUploading && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Preview — <span className="text-muted-foreground font-normal">{fileName}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {parsed.headers.length} columns · {parsed.totalRows.toLocaleString()} rows
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-auto max-h-[380px]">
                <table className="w-full data-grid">
                  <thead>
                    <tr className="bg-muted/50 sticky top-0">
                      {parsed.headers.map((header, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-t border-border hover:bg-muted/30 transition-colors"
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 text-xs text-secondary-foreground whitespace-nowrap max-w-[200px] truncate"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing first {Math.min(parsed.rows.length, 50)} rows
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Global error banner ── */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError("")}
              className="ml-auto hover:opacity-70 transition-opacity"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}