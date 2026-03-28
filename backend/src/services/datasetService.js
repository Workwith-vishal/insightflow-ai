import Papa from "papaparse";

const DOMAIN_KEYWORDS = {
  finance: ["revenue", "profit", "sales", "price", "cost", "income", "expense", "budget", "tax"],
  healthcare: ["patient", "diagnosis", "treatment", "hospital", "medical", "health", "symptom"],
  education: ["student", "grade", "course", "school", "university", "teacher", "exam"],
  ecommerce: ["product", "order", "customer", "cart", "shipping", "payment", "review"],
  hr: ["employee", "salary", "department", "hire", "position", "manager", "attendance"],
  marketing: ["campaign", "click", "impression", "conversion", "channel", "ad", "roi"],
};

const normalizeText = (value) => String(value ?? "").trim();

const parseNumber = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const accountingNegative = raw.startsWith("(") && raw.endsWith(")");
  const core = accountingNegative ? raw.slice(1, -1) : raw;
  let cleaned = core.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  if (accountingNegative && cleaned && !cleaned.startsWith("-")) {
    cleaned = `-${cleaned}`;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const looksLikeDate = (value) => {
  const raw = normalizeText(value);
  if (!raw) return false;
  if (/^\d{4}$/.test(raw)) return true;
  return Number.isFinite(Date.parse(raw));
};

const toMonthKey = (value) => {
  const raw = normalizeText(value);
  if (/^\d{4}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
};

const detectColumnType = (header, values) => {
  const filled = values.filter(Boolean);
  if (!filled.length) return "text";

  const numericRatio = filled.filter((value) => parseNumber(value) !== null).length / filled.length;
  if (numericRatio >= 0.7) return "numeric";

  const dateRatio = filled.filter((value) => looksLikeDate(value)).length / filled.length;
  if (dateRatio >= 0.7 || /(date|time|month|year|quarter)/i.test(header)) return "datetime";

  const uniqueCount = new Set(filled).size;
  if (uniqueCount >= 2 && uniqueCount <= Math.min(20, Math.max(6, Math.floor(filled.length * 0.5)))) {
    return "categorical";
  }

  return "text";
};

const toTitleCase = (value) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const detectDomain = (headers) => {
  const joined = headers.join(" ").toLowerCase();
  const scored = Object.entries(DOMAIN_KEYWORDS)
    .map(([key, keywords]) => ({
      key,
      score: keywords.filter((keyword) => joined.includes(keyword)).length,
      matchedColumns: headers.filter((header) =>
        keywords.some((keyword) => header.toLowerCase().includes(keyword)),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 1) {
    return {
      key: "general",
      label: "General",
      confidence: 0.55,
      matchedColumns: [],
      description: "A general-purpose dataset with no dominant domain keywords.",
    };
  }

  return {
    key: best.key,
    label: toTitleCase(best.key),
    confidence: Math.min(0.95, 0.55 + best.score * 0.15),
    matchedColumns: best.matchedColumns,
    description: `Detected ${toTitleCase(best.key)} patterns from the uploaded dataset columns.`,
  };
};

const topEntries = (map, limit = 10) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

const buildColumnProfiles = (headers, records) =>
  headers.map((header) => {
    const values = records.map((row) => normalizeText(row[header]));
    const filled = values.filter(Boolean);
    const uniqueValues = [...new Set(filled)];
    const detectedType = detectColumnType(header, values);
    const numericValues = filled
      .map((value) => parseNumber(value))
      .filter((value) => value !== null);

    const profile = {
      name: header,
      filled: filled.length,
      unique: uniqueValues.length,
      sampleValues: uniqueValues.slice(0, 5),
      numeric: detectedType === "numeric",
      detectedType,
    };

    if (detectedType === "numeric" && numericValues.length) {
      const sum = numericValues.reduce((total, value) => total + value, 0);
      return {
        ...profile,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        average: sum / numericValues.length,
        sum,
      };
    }

    return profile;
  });

const buildKpis = (records, columns) => {
  const kpis = [
    {
      label: "Total Records",
      value: records.length.toLocaleString(),
      helperText: "Rows in the uploaded dataset",
    },
  ];

  const numericColumns = columns.filter((column) => column.numeric);
  const categoricalColumns = columns.filter((column) => column.detectedType === "categorical");

  numericColumns.slice(0, 2).forEach((column) => {
    if (typeof column.sum === "number") {
      kpis.push({
        label: `Total ${column.name}`,
        value: column.sum.toFixed(2),
        helperText: `Sum of ${column.name}`,
      });
    }

    if (typeof column.average === "number") {
      kpis.push({
        label: `Avg ${column.name}`,
        value: column.average.toFixed(2),
        helperText: `Average ${column.name}`,
      });
    }
  });

  if (categoricalColumns[0]) {
    kpis.push({
      label: `Unique ${categoricalColumns[0].name}`,
      value: String(categoricalColumns[0].unique),
      helperText: `Distinct ${categoricalColumns[0].name} values`,
    });
  }

  return kpis.slice(0, 6);
};

const buildInsights = (records, columns, domain) => {
  const numericColumns = columns.filter((column) => column.numeric);
  const categoricalColumns = columns.filter((column) => column.detectedType === "categorical");
  const insights = [
    `This ${domain.label.toLowerCase()} dataset contains ${records.length.toLocaleString()} records across ${columns.length} columns.`,
  ];

  if (numericColumns[0] && typeof numericColumns[0].average === "number") {
    insights.push(
      `${numericColumns[0].name} averages ${numericColumns[0].average.toFixed(2)} with values from ${numericColumns[0].min?.toFixed(2)} to ${numericColumns[0].max?.toFixed(2)}.`,
    );
  }

  if (categoricalColumns[0]) {
    insights.push(
      `${categoricalColumns[0].name} contains ${categoricalColumns[0].unique} distinct categories.`,
    );
  }

  return insights;
};

const buildHistogram = (header, records) => {
  const values = records
    .map((row) => parseNumber(row[header]))
    .filter((value) => value !== null);

  if (values.length < 4) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketCount = Math.min(8, Math.max(4, Math.floor(Math.sqrt(values.length))));
  const span = max - min || 1;

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    name: `${(min + (span * index) / bucketCount).toFixed(1)}-${(min + (span * (index + 1)) / bucketCount).toFixed(1)}`,
    value: 0,
  }));

  values.forEach((value) => {
    const ratio = (value - min) / span;
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)));
    buckets[index].value += 1;
  });

  return {
    title: `${header} Distribution`,
    type: "bar",
    xKey: "name",
    dataKey: "value",
    data: buckets,
    config: {
      xLabel: header,
      yLabel: "Count",
      palette: "amber",
    },
  };
};

const buildChartSuggestions = (records, columns) => {
  const charts = [];
  const numericColumns = columns.filter((column) => column.numeric);
  const categoricalColumns = columns.filter((column) => column.detectedType === "categorical");
  const dateColumns = columns.filter((column) => column.detectedType === "datetime");

  if (categoricalColumns[0]) {
    const counts = new Map();
    records.forEach((row) => {
      const key = normalizeText(row[categoricalColumns[0].name]);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const data = topEntries(counts, 10).map(([name, value]) => ({ name, value }));
    charts.push({
      title: `${categoricalColumns[0].name} Distribution`,
      type: data.length <= 6 ? "pie" : "bar",
      xKey: "name",
      dataKey: "value",
      data,
      config: {
        xLabel: categoricalColumns[0].name,
        yLabel: "Count",
        palette: "cyan",
        showLegend: data.length <= 6,
      },
    });
  }

  if (dateColumns[0] && numericColumns[0]) {
    const grouped = new Map();
    records.forEach((row) => {
      const dateKey = toMonthKey(row[dateColumns[0].name]);
      const numeric = parseNumber(row[numericColumns[0].name]);
      if (!dateKey || numeric === null) return;
      grouped.set(dateKey, (grouped.get(dateKey) || 0) + numeric);
    });

    const data = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

    if (data.length > 1) {
      charts.push({
        title: `${numericColumns[0].name} Over Time`,
        type: "line",
        xKey: "name",
        dataKey: "value",
        data,
        config: {
          xLabel: dateColumns[0].name,
          yLabel: numericColumns[0].name,
          curved: true,
          palette: "emerald",
        },
      });
    }
  }

  if (categoricalColumns[0] && numericColumns[0]) {
    const grouped = new Map();
    records.forEach((row) => {
      const category = normalizeText(row[categoricalColumns[0].name]);
      const numeric = parseNumber(row[numericColumns[0].name]);
      if (!category || numeric === null) return;
      const current = grouped.get(category) || { sum: 0, count: 0 };
      grouped.set(category, { sum: current.sum + numeric, count: current.count + 1 });
    });

    const data = [...grouped.entries()]
      .map(([name, meta]) => ({
        name,
        value: Number((meta.sum / Math.max(meta.count, 1)).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    if (data.length) {
      charts.push({
        title: `Average ${numericColumns[0].name} by ${categoricalColumns[0].name}`,
        type: "bar",
        xKey: "name",
        dataKey: "value",
        data,
        config: {
          xLabel: categoricalColumns[0].name,
          yLabel: `Avg ${numericColumns[0].name}`,
          palette: "violet",
        },
      });
    }
  }

  if (numericColumns[0]) {
    const histogram = buildHistogram(numericColumns[0].name, records);
    if (histogram) charts.push(histogram);
  }

  return charts.slice(0, 6);
};

export const parseCsvDataset = ({ fileName, csvText }) => {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || "Failed to parse CSV.");
  }

  const headers = (parsed.meta.fields || []).map((field) => field.trim()).filter(Boolean);
  if (!headers.length) {
    throw new Error("CSV file is missing a header row.");
  }

  const records = parsed.data
    .map((row) =>
      Object.fromEntries(
        headers.map((header) => [header, normalizeText(row[header])]),
      ),
    )
    .filter((row) => headers.some((header) => row[header] !== ""));

  if (!records.length) {
    throw new Error("CSV file does not contain any data rows.");
  }

  const columns = buildColumnProfiles(headers, records);
  const domain = detectDomain(headers);

  return {
    id: "current",
    fileName,
    uploadedAt: new Date().toISOString(),
    headers,
    totalRows: records.length,
    previewRows: records.slice(0, 100).map((row) => headers.map((header) => row[header] || "")),
    records,
    summary: {
      rowCount: records.length,
      columnCount: headers.length,
      domain,
      columns,
      kpis: buildKpis(records, columns),
      insights: buildInsights(records, columns, domain),
      chartSuggestions: buildChartSuggestions(records, columns),
    },
  };
};

