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

        const columns = analyzeColumns(rows);

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

export const analyzeColumns = (rows: DataRow[]): ColumnMetadata[] => {
    if (rows.length === 0) return [];
    
    const keys = Object.keys(rows[0]).filter(k => k !== 'id');
    return keys.map(key => {
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
        
        // Simple variance-based importance proxy (normalized)
        let importance = 0;
        if (type === 'number' && min !== undefined && max !== undefined && max !== min) {
             importance = unique / rows.length; // High cardinality relative to size often implies info
        }

        return {
            name: key,
            originalName: key,
            type,
            missingCount: values.length - nonNull.length,
            uniqueCount: unique,
            min,
            max,
            mean,
            isActive: true,
            importanceScore: importance
        };
    });
}

export const filterDataset = (rows: DataRow[], query: string): DataRow[] => {
    if(!query) return rows;
    const lower = query.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(lower)));
};

export const transposeDataset = (dataset: Dataset): Dataset => {
    // 1. Get all keys
    const originalKeys = dataset.columns.map(c => c.name);
    
    // 2. New Rows become the old columns
    const newRows: DataRow[] = originalKeys.map((key, index) => {
        const newRow: any = { id: index, 'Attribute': key };
        dataset.rows.forEach((oldRow, i) => {
            newRow[`Row_${i}`] = oldRow[key];
        });
        return newRow;
    });

    const newColumns = analyzeColumns(newRows);
    
    return {
        ...dataset,
        rows: newRows,
        columns: newColumns
    };
};

export const setHeaderRow = (dataset: Dataset, rowIndex: number): Dataset => {
    if (rowIndex < 0 || rowIndex >= dataset.rows.length) return dataset;

    const potentialHeaderRow = dataset.rows[rowIndex];
    const newKeys = Object.values(potentialHeaderRow).filter(k => k !== potentialHeaderRow.id).map(String);
    
    // Map remaining rows to new keys
    const newRows = dataset.rows.slice(rowIndex + 1).map((oldRow, i) => {
        const newRow: any = { id: i };
        let colIndex = 0;
        // Iterate old keys to map to new keys by position
        Object.keys(oldRow).forEach(key => {
            if(key === 'id') return;
            if(colIndex < newKeys.length) {
                newRow[newKeys[colIndex]] = oldRow[key];
                colIndex++;
            }
        });
        return newRow;
    });

    return {
        ...dataset,
        rows: newRows,
        columns: analyzeColumns(newRows)
    };
};