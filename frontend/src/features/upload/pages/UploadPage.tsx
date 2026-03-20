import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export default function UploadPage() {
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError("");
    setFileName(file.name);

    Papa.parse(file, {
      complete: (result) => {
        const data = result.data as string[][];
        if (data.length < 2) {
          setError("File appears empty or has no data rows.");
          return;
        }
        setParsed({
          headers: data[0],
          rows: data.slice(1, 101), // preview first 100
          totalRows: data.length - 1,
        });
      },
      error: () => setError("Failed to parse CSV file."),
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Upload Dataset</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload a CSV file to start analyzing your data with AI.</p>
      </div>

      {!parsed ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-sm text-foreground font-medium">
              {isDragActive ? "Drop your file here" : "Drag & drop a CSV file, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Max 20MB · CSV format only</p>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-lg p-4 card-elevated flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {parsed.headers.length} columns · {parsed.totalRows.toLocaleString()} rows
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-chart-emerald" />
            </div>

            <div className="bg-card rounded-lg card-elevated overflow-hidden">
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-medium text-foreground">Data Preview</h3>
                <p className="text-xs text-muted-foreground">Showing first {Math.min(parsed.rows.length, 100)} rows</p>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full data-grid">
                  <thead>
                    <tr className="bg-muted/50">
                      {parsed.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-xs text-secondary-foreground whitespace-nowrap max-w-[200px] truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => { setParsed(null); setFileName(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Upload a different file
            </button>
          </motion.div>
        </AnimatePresence>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
