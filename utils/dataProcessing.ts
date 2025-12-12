import Papa from 'papaparse';
import { ColumnMetadata, DataRow, Dataset } from '../types';

export const parseCSV = (file: File): Promise<Dataset> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV Errors:", results.errors);
        }
        
        const rawRows = results.data as any[];
        // Add artificial ID if not present
        const rows: DataRow[] = rawRows.map((r, i) => ({ ...r, id: r.id || i }));
        
        // Analyze Columns
        if (rows.length === 0) {
            resolve({ name: file.name, rows: [], columns: [] });
            return;
        }

        const keys = Object.keys(rows[0]).filter(k => k !== 'id');
        const columns: ColumnMetadata[] = keys.map(key => {
            const values = rows.map(r => r[key]);
            const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
            
            // Type inference
            const isNumber = nonNull.every(v => typeof v === 'number');
            const isDate = !isNumber && nonNull.every(v => !isNaN(Date.parse(String(v))));
            
            let type: ColumnMetadata['type'] = 'string';
            if (isNumber) type = 'number';
            else if (isDate) type = 'date';

            // Stats
            let min, max, mean;
            if (type === 'number' && nonNull.length > 0) {
                // Use explicit loop to prevent Maximum call stack size exceeded error with spread operator on large arrays
                let localMin = Infinity;
                let localMax = -Infinity;
                let sum = 0;
                const numbers = nonNull as number[];
                const len = numbers.length;
                
                for (let i = 0; i < len; i++) {
                    const val = numbers[i];
                    if (val < localMin) localMin = val;
                    if (val > localMax) localMax = val;
                    sum += val;
                }
                
                min = localMin;
                max = localMax;
                mean = sum / len;
            }

            const unique = new Set(values.map(v => String(v))).size;

            return {
                name: key,
                type,
                missingCount: values.length - nonNull.length,
                uniqueCount: unique,
                min,
                max,
                mean
            };
        });

        resolve({
            name: file.name,
            rows,
            columns
        });
      },
      error: (err) => reject(err)
    });
  });
};

export const filterDataset = (rows: DataRow[], query: string): DataRow[] => {
    if(!query) return rows;
    const lower = query.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(lower)));
};