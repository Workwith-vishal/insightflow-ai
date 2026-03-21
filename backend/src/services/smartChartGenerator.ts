import { ColumnProfile } from '../utils/columnClassifier';

export interface GeneratedChart {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'histogram';
  data: any[];
  x_axis: string;
  y_axis: string;
  description: string;
  is_valid: boolean;
}

export function generateSmartCharts(
  data: any[],
  columns: ColumnProfile[]
): GeneratedChart[] {
  const charts: GeneratedChart[] = [];

  // Filter valid columns (exclude IDs, row indexes)
  const validColumns = columns.filter(c => !c.should_exclude);
  const numericColumns = validColumns.filter(c => c.type === 'numeric');
  const categoricalColumns = validColumns.filter(c => c.type === 'categorical');
  const dateColumns = validColumns.filter(c => c.type === 'date');

  // Chart 1: Numeric Distribution (if any numeric columns)
  if (numericColumns.length > 0) {
    const col = numericColumns[0];
    charts.push({
      id: `numeric_dist_${col.name}`,
      title: `${col.name} Distribution`,
      type: 'histogram',
      x_axis: col.name,
      y_axis: 'Frequency',
      data: generateHistogram(data, col.name),
      description: `Distribution of ${col.name}`,
      is_valid: true
    });
  }

  // Chart 2: Categorical Counts (if any categorical columns)
  if (categoricalColumns.length > 0) {
    const col = categoricalColumns[0];
    charts.push({
      id: `categorical_counts_${col.name}`,
      title: `${col.name} Breakdown`,
      type: 'bar',
      x_axis: col.name,
      y_axis: 'Count',
      data: generateCategoricalCounts(data, col.name),
      description: `Count of unique values in ${col.name}`,
      is_valid: true
    });
  }

  // Chart 3: Time Series (if date column + numeric column)
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const dateCol = dateColumns[0];
    const numCol = numericColumns[0];
    charts.push({
      id: `timeseries_${dateCol.name}_${numCol.name}`,
      title: `${numCol.name} Over Time`,
      type: 'line',
      x_axis: dateCol.name,
      y_axis: numCol.name,
      data: generateTimeSeries(data, dateCol.name, numCol.name),
      description: `${numCol.name} trend over ${dateCol.name}`,
      is_valid: true
    });
  }

  // Chart 4: Top Categories (if categorical column exists)
  if (categoricalColumns.length > 1) {
    const col = categoricalColumns[1];
    charts.push({
      id: `top_categories_${col.name}`,
      title: `Top ${col.name}`,
      type: 'bar',
      x_axis: col.name,
      y_axis: 'Count',
      data: generateTopCategories(data, col.name, 10),
      description: `Top 10 values in ${col.name}`,
      is_valid: true
    });
  }

  return charts;
}

function generateHistogram(data: any[], column: string): any[] {
  const values = data.map(d => parseFloat(d[column])).filter(v => !isNaN(v));
  const bins = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins;

  const histogram = Array(bins).fill(0);
  values.forEach(v => {
    const binIndex = Math.floor((v - min) / binSize);
    if (binIndex < bins) histogram[binIndex]++;
  });

  return histogram.map((count, i) => ({
    range: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
    count
  }));
}

function generateCategoricalCounts(data: any[], column: string): any[] {
  const counts: Record<string, number> = {};
  data.forEach(row => {
    const val = row[column];
    counts[val] = (counts[val] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function generateTimeSeries(data: any[], dateColumn: string, valueColumn: string): any[] {
  const grouped: Record<string, number> = {};

  data.forEach(row => {
    const date = new Date(row[dateColumn]).toISOString().split('T')[0];
    const value = parseFloat(row[valueColumn]);
    if (!isNaN(value)) {
      grouped[date] = (grouped[date] || 0) + value;
    }
  });

  return Object.entries(grouped)
    .sort()
    .map(([date, value]) => ({ date, value }));
}

function generateTopCategories(data: any[], column: string, limit: number): any[] {
  return generateCategoricalCounts(data, column).slice(0, limit);
}