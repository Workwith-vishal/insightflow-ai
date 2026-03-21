// Classify columns intelligently
export interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'text' | 'id';
  unique_count: number;
  nulls: number;
  sample_values: (string | number)[];
  is_id_like: boolean;
  should_exclude: boolean;
}

export function classifyColumns(data: any[], headers: string[]): ColumnProfile[] {
  return headers.map((header) => {
    const values = data.map(row => row[header]).filter(v => v != null);
    const uniqueCount = new Set(values).size;
    const nullCount = data.length - values.length;
    const samples = values.slice(0, 5);

    // Detect column type
    let type: ColumnProfile['type'] = 'text';
    
    // ID-like detection: show_id, user_id, product_id, etc.
    const isIdLike = 
      header.toLowerCase().includes('_id') ||
      header.toLowerCase().includes('id_') ||
      /^id$/i.test(header) ||
      (uniqueCount === data.length && typeof values[0] === 'number');

    // Numeric detection
    if (values.every(v => !isNaN(Number(v)))) {
      type = 'numeric';
    }
    // Date detection
    else if (values.every(v => !isNaN(Date.parse(String(v))))) {
      type = 'date';
    }
    // Categorical (high cardinality but bounded)
    else if (uniqueCount / data.length < 0.5 && uniqueCount < 100) {
      type = 'categorical';
    }

    return {
      name: header,
      type,
      unique_count: uniqueCount,
      nulls: nullCount,
      sample_values: samples,
      is_id_like: isIdLike,
      should_exclude: isIdLike || (["id"].includes(type) || header.toLowerCase() === 'row')
    };
  });
}