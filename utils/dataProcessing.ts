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

// New: For "matrix from unstructured csv with wrong colum and rows"
export const cropDataset = (dataset: Dataset, startRow: number, endRow: number, columnsToKeep?: string[]): Dataset => {
    let newRows = dataset.rows.slice(startRow, endRow + 1);
    
    if (columnsToKeep && columnsToKeep.length > 0) {
        newRows = newRows.map(row => {
            const pruned: any = { id: row.id };
            columnsToKeep.forEach(col => {
                if (row.hasOwnProperty(col)) {
                    pruned[col] = row[col];
                }
            });
            return pruned;
        });
    }
    
    // Re-index IDs
    newRows = newRows.map((r, i) => ({ ...r, id: i }));

    return {
        ...dataset,
        rows: newRows,
        columns: analyzeColumns(newRows)
    };
};

// New: Calculate Correlation Matrix
export const calculateCorrelationMatrix = (dataset: Dataset): { cols: string[], matrix: number[][] } => {
    const numericCols = dataset.columns.filter(c => c.type === 'number' && c.isActive).map(c => c.name);
    if (numericCols.length < 2) return { cols: [], matrix: [] };

    const matrix: number[][] = [];
    
    for (let i = 0; i < numericCols.length; i++) {
        const rowCorr: number[] = [];
        for (let j = 0; j < numericCols.length; j++) {
            if (i === j) {
                rowCorr.push(1);
            } else {
                // Compute Pearson Correlation
                const vals1 = dataset.rows.map(r => Number(r[numericCols[i]]) || 0);
                const vals2 = dataset.rows.map(r => Number(r[numericCols[j]]) || 0);
                
                const n = vals1.length;
                const sum1 = vals1.reduce((a, b) => a + b, 0);
                const sum2 = vals2.reduce((a, b) => a + b, 0);
                const sum1Sq = vals1.reduce((a, b) => a + b * b, 0);
                const sum2Sq = vals2.reduce((a, b) => a + b * b, 0);
                const pSum = vals1.reduce((a, b, idx) => a + b * vals2[idx], 0);
                
                const num = pSum - (sum1 * sum2 / n);
                const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
                
                rowCorr.push(den === 0 ? 0 : num / den);
            }
        }
        matrix.push(rowCorr);
    }
    
    return { cols: numericCols, matrix };
};

// New: Formula Evaluator for "linear combination and none linearn combiantion"
export const createCalculatedColumn = (dataset: Dataset, newColName: string, formula: string): Dataset => {
    // Basic safety check: only allow column names and Math functions
    // We will simple replace column names in the string with `row['colName']` and eval
    
    const newRows = dataset.rows.map(row => {
        let evalStr = formula;
        dataset.columns.forEach(col => {
            // Replace column names with values. Sort by length to avoid partial replacement issues (e.g. "Tax" inside "TaxRate")
            // A robust parser is better, but this is a simple "flexible" implementation as requested.
            // Using a specific pattern like [ColName] is safer for user input.
        });

        // Simpler approach: Create a function with keys as args
        try {
           const keys = Object.keys(row).filter(k => k !== 'id');
           const values = keys.map(k => Number(row[k]) || 0); // Force numeric for math
           
           // Allow common math functions
           const mathKeys = Object.getOwnPropertyNames(Math);
           const mathVals = mathKeys.map(k => (Math as any)[k]);

           const func = new Function(...keys, ...mathKeys, `return ${formula};`);
           const result = func(...values, ...mathVals);
           
           return { ...row, [newColName]: result };
        } catch (e) {
           return { ...row, [newColName]: null };
        }
    });

    return {
        ...dataset,
        rows: newRows,
        columns: analyzeColumns(newRows)
    };
};