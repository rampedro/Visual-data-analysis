import Papa from 'papaparse';
import { ColumnMetadata, DataRow, Dataset, TransformationConfig } from '../types';

// Helper to process raw array data into our Dataset structure
const processRawData = (rawData: any[][], fileName: string): Dataset => {
    if (rawData.length === 0) {
        return { 
            id: crypto.randomUUID(), 
            name: fileName, 
            rows: [], 
            columns: [], 
            stats: { originalRows: 0, totalCells: 0, imputedCells: 0, droppedRows: 0 }, 
            created: Date.now() 
        };
    }

    let bestHeaderIndex = 0;
    let maxCols = 0;
    // Look at first 20 rows to find the best header candidate
    for(let i=0; i<Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        // Heuristic: Count non-empty string values
        const nonNullCount = row.filter(c => c !== null && c !== '' && typeof c === 'string').length;
        if(nonNullCount > maxCols) { maxCols = nonNullCount; bestHeaderIndex = i; }
    }

    const headerRow = rawData[bestHeaderIndex].map(String);
    const uniqueHeaders = headerRow.map((h, i) => {
        const count = headerRow.slice(0, i).filter(x => x === h).length;
        return count === 0 ? h : `${h}_${count + 1}`;
    });

    const rows: DataRow[] = rawData.slice(bestHeaderIndex + 1).map((rowArray, i) => {
        const rowObj: any = { id: i };
        uniqueHeaders.forEach((header, index) => rowObj[header] = rowArray[index]);
        return rowObj;
    });
    
    const columns = analyzeColumns(rows);

    return {
        id: crypto.randomUUID(),
        name: fileName,
        rows,
        columns,
        stats: { 
            originalRows: rows.length, 
            totalCells: rows.length * columns.length, 
            imputedCells: 0, 
            droppedRows: bestHeaderIndex 
        },
        created: Date.now()
    };
};

export const parseCSV = (file: File, onProgress?: (percent: number) => void): Promise<Dataset> => {
  return new Promise((resolve, reject) => {
    let rows: any[] = [];
    const totalSize = file.size;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      worker: true, // Use a web worker to not block UI
      chunk: (results) => {
         rows = rows.concat(results.data);
         if (onProgress && results.meta.cursor) {
             const percent = Math.min(99, Math.round((results.meta.cursor / totalSize) * 100));
             onProgress(percent);
         }
      },
      complete: () => {
        if (onProgress) onProgress(100);
        setTimeout(() => {
            try {
                const dataset = processRawData(rows, file.name);
                resolve(dataset);
            } catch (e) {
                reject(e);
            }
        }, 100);
      },
      error: (err) => reject(err)
    });
  });
};

export const parseGeoJSON = (file: File): Promise<Dataset> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                const features = json.features || (json.type === 'FeatureCollection' ? json.features : [json]);
                
                const rows: DataRow[] = features.map((f: any, i: number) => {
                    // Flatten properties
                    const row: any = { id: i, ...f.properties };
                    
                    // Extract Geometry centroids for quick mapping
                    if (f.geometry) {
                        if (f.geometry.type === 'Point') {
                            row['_lng'] = f.geometry.coordinates[0];
                            row['_lat'] = f.geometry.coordinates[1];
                        } else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
                            // Rough centroid approximation for visualization
                            // In a real backend we'd use Turf.js, here we simple average
                            // This keeps it "super fast"
                            row['_geo_type'] = f.geometry.type;
                        }
                    }
                    return row;
                });

                const columns = analyzeColumns(rows);
                
                resolve({
                    id: crypto.randomUUID(),
                    name: file.name,
                    rows,
                    columns,
                    stats: { 
                        originalRows: rows.length, 
                        totalCells: rows.length * columns.length, 
                        imputedCells: 0, 
                        droppedRows: 0 
                    },
                    created: Date.now()
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}

export const analyzeColumns = (rows: DataRow[]): ColumnMetadata[] => {
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]).filter(k => k !== 'id');
    return keys.map(key => {
        const values = rows.map(r => r[key]);
        const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
        
        // Strict number check
        const isNumber = nonNull.length > 0 && nonNull.every(v => typeof v === 'number');
        const isDate = !isNumber && nonNull.length > 0 && nonNull.every(v => !isNaN(Date.parse(String(v))));
        
        let type: ColumnMetadata['type'] = 'string';
        if (isNumber) type = 'number';
        else if (isDate) type = 'date';

        let min, max, mean;
        if (type === 'number' && nonNull.length > 0) {
            const numbers = nonNull as number[];
            min = Math.min(...numbers);
            max = Math.max(...numbers);
            mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        }
        const unique = new Set(values.map(v => String(v))).size;
        
        // Importance heuristic
        let importance = 0;
        if (type === 'number' && max !== min) importance = unique / rows.length;
        
        // Simple heuristic for categories
        const categories = unique < 20 ? Array.from(new Set(values.map(v => String(v)))).slice(0, 10) : undefined;

        return {
            name: key, originalName: key, type,
            missingCount: values.length - nonNull.length,
            uniqueCount: unique, min, max, mean, isActive: true, importanceScore: importance,
            categories
        };
    });
}

// Smart Heuristic for suggestions
export const suggestTransformations = (col: ColumnMetadata, sampleValues: any[]): TransformationConfig[] => {
    const suggestions: TransformationConfig[] = [];
    const samples = sampleValues.filter(v => typeof v === 'string').slice(0, 5);

    if (col.type === 'string') {
        // Check for delimiters
        if (samples.some(s => s.includes(','))) {
            suggestions.push({ type: 'split_count', targetCol: col.name, params: { delimiter: ',' } });
            suggestions.push({ type: 'split_extract', targetCol: col.name, params: { delimiter: ',', index: 0 } });
        }
        if (samples.some(s => s.includes('|'))) {
             suggestions.push({ type: 'split_count', targetCol: col.name, params: { delimiter: '|' } });
        }
        // Check for Email
        if (samples.some(s => /@/.test(s))) {
            suggestions.push({ type: 'extract_regex', targetCol: col.name, params: { regex: '([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)', name: 'Email' } });
        }
    }
    return suggestions;
};

export const applyTransformation = (dataset: Dataset, config: TransformationConfig): Dataset => {
    let newRows = [...dataset.rows];
    let newColName = '';

    switch (config.type) {
        case 'split_count':
            newColName = `${config.targetCol}_Count`;
            newRows = newRows.map(r => ({
                ...r,
                [newColName]: String(r[config.targetCol] || '').split(config.params.delimiter).length
            }));
            break;
        case 'split_extract':
            newColName = `${config.targetCol}_Part${config.params.index}`;
            newRows = newRows.map(r => {
                const parts = String(r[config.targetCol] || '').split(config.params.delimiter);
                return { ...r, [newColName]: parts[config.params.index] || '' };
            });
            break;
        case 'to_uppercase':
            newColName = `${config.targetCol}_Upper`;
            newRows = newRows.map(r => ({ ...r, [newColName]: String(r[config.targetCol] || '').toUpperCase() }));
            break;
        case 'math_log':
            newColName = `Log_${config.targetCol}`;
            newRows = newRows.map(r => ({ 
                ...r, 
                [newColName]: r[config.targetCol] ? Math.log(Number(r[config.targetCol])) : 0 
            }));
            break;
        case 'math_add': // Example param: value to add
             newColName = `${config.targetCol}_Plus`;
             newRows = newRows.map(r => ({ ...r, [newColName]: (Number(r[config.targetCol]) || 0) + (config.params.value || 0) }));
             break;
    }

    return {
        ...dataset,
        rows: newRows,
        columns: analyzeColumns(newRows),
        stats: { ...dataset.stats, totalCells: newRows.length * (dataset.columns.length + 1) }
    };
};

export const convertColumnType = (dataset: Dataset, colName: string, targetType: 'string' | 'number'): Dataset => {
    const newRows = dataset.rows.map(row => {
        const val = row[colName];
        let newVal = val;
        
        if (targetType === 'number') {
            const parsed = parseFloat(String(val).replace(/,/g, ''));
            newVal = isNaN(parsed) ? null : parsed;
        } else {
            newVal = val === null || val === undefined ? '' : String(val);
        }
        
        return { ...row, [colName]: newVal };
    });

    return {
        ...dataset,
        rows: newRows,
        columns: analyzeColumns(newRows)
    };
};

export const joinDatasets = (
    primary: Dataset, 
    secondary: Dataset, 
    primaryKey: string, 
    secondaryKey: string
): Dataset => {
    // Index secondary dataset for O(1) lookup
    const secondaryIndex = new Map();
    secondary.rows.forEach(row => {
        const key = String(row[secondaryKey]);
        if (key) secondaryIndex.set(key, row);
    });

    const combinedRows = primary.rows.map(pRow => {
        const pKey = String(pRow[primaryKey]);
        const sRow = secondaryIndex.get(pKey);
        
        // Merge rows, handle potential key collisions by prefixing secondary columns if needed
        // For simplicity here, we assume unique column names or overwrite
        if (sRow) {
            const merged: any = { ...pRow };
            Object.keys(sRow).forEach(k => {
                if (k !== 'id' && k !== secondaryKey) {
                    // Check collision
                    const finalKey = primary.columns.find(c => c.name === k) ? `${secondary.name}_${k}` : k;
                    merged[finalKey] = sRow[k];
                }
            });
            return merged;
        }
        return pRow;
    });

    return {
        ...primary,
        id: crypto.randomUUID(),
        name: `${primary.name} + ${secondary.name}`,
        rows: combinedRows,
        columns: analyzeColumns(combinedRows),
        stats: { ...primary.stats, totalCells: combinedRows.length * Object.keys(combinedRows[0] || {}).length }
    };
};

// Simple TF-IDF Vectorization for Text Analysis Visualization
export const computeTextEmbeddings = (rows: DataRow[], colName: string): number[][] => {
    // 1. Tokenize and build vocabulary
    const docs = rows.map(r => String(r[colName] || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    const vocab = new Map<string, number>();
    
    // Count document frequency
    const docFreq = new Map<string, number>();
    
    docs.forEach(tokens => {
        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach(t => {
            docFreq.set(t, (docFreq.get(t) || 0) + 1);
        });
    });

    // Filter vocab by min frequency to reduce dimensions (e.g., must appear in 2 docs)
    // and sort by frequency to take top 100 features for visualization performance
    const sortedVocab = Array.from(docFreq.entries())
        .filter(([_, count]) => count > 1) 
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50) // Limit to top 50 terms for performance in browser
        .map(x => x[0]);
    
    sortedVocab.forEach((w, i) => vocab.set(w, i));
    
    const N = docs.length;
    
    // 2. Vectorize
    const vectors: number[][] = docs.map(tokens => {
        const vec = new Array(sortedVocab.length).fill(0);
        const termCounts = new Map<string, number>();
        tokens.forEach(t => termCounts.set(t, (termCounts.get(t) || 0) + 1));
        
        termCounts.forEach((count, term) => {
            const idx = vocab.get(term);
            if (idx !== undefined) {
                const tf = count / tokens.length;
                const idf = Math.log(N / (docFreq.get(term) || 1));
                vec[idx] = tf * idf;
            }
        });
        return vec;
    });

    return vectors;
};

export const filterDataset = (rows: DataRow[], query: string): DataRow[] => {
    if(!query) return rows;
    const lower = query.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(lower)));
};

export const transposeDataset = (dataset: Dataset): Dataset => {
    const originalKeys = dataset.columns.map(c => c.name);
    const newRows: DataRow[] = originalKeys.map((key, index) => {
        const newRow: any = { id: index, 'Attribute': key };
        dataset.rows.forEach((oldRow, i) => {
            newRow[`Row_${i}`] = oldRow[key];
        });
        return newRow;
    });
    const newColumns = analyzeColumns(newRows);
    return { ...dataset, rows: newRows, columns: newColumns, stats: { ...dataset.stats, totalCells: newRows.length * newColumns.length } };
};

export const setHeaderRow = (dataset: Dataset, rowIndex: number): Dataset => {
    if (rowIndex < 0 || rowIndex >= dataset.rows.length) return dataset;
    const potentialHeaderRow = dataset.rows[rowIndex];
    const newKeys = Object.values(potentialHeaderRow).filter(k => k !== potentialHeaderRow.id).map(String);
    const newRows = dataset.rows.slice(rowIndex + 1).map((oldRow, i) => {
        const newRow: any = { id: i };
        let colIndex = 0;
        Object.keys(oldRow).forEach(key => {
            if(key === 'id') return;
            if(colIndex < newKeys.length) { newRow[newKeys[colIndex]] = oldRow[key]; colIndex++; }
        });
        return newRow;
    });
    return { ...dataset, rows: newRows, columns: analyzeColumns(newRows), stats: { ...dataset.stats, droppedRows: dataset.stats.droppedRows + (rowIndex + 1) } };
};

export const cropDataset = (dataset: Dataset, startRow: number, endRow: number, columnsToKeep?: string[]): Dataset => {
    const originalLen = dataset.rows.length;
    let newRows = dataset.rows.slice(startRow, endRow + 1);
    const droppedCount = originalLen - newRows.length;
    if (columnsToKeep && columnsToKeep.length > 0) {
        newRows = newRows.map(row => {
            const pruned: any = { id: row.id };
            columnsToKeep.forEach(col => { if (row.hasOwnProperty(col)) pruned[col] = row[col]; });
            return pruned;
        });
    }
    newRows = newRows.map((r, i) => ({ ...r, id: i }));
    return { ...dataset, rows: newRows, columns: analyzeColumns(newRows), stats: { ...dataset.stats, droppedRows: dataset.stats.droppedRows + droppedCount } };
};

export const updateCell = (dataset: Dataset, rowId: number | string, colName: string, value: any): Dataset => {
    const newRows = dataset.rows.map(r => {
        if (r.id === rowId) {
            return { ...r, [colName]: value };
        }
        return r;
    });
    // We don't re-analyze columns every edit for performance, assume type consistency
    return { ...dataset, rows: newRows };
};

export const calculateCorrelationMatrix = (dataset: Dataset): { cols: string[], matrix: number[][] } => {
    const numericCols = dataset.columns.filter(c => c.type === 'number' && c.isActive).map(c => c.name);
    if (numericCols.length < 2) return { cols: [], matrix: [] };
    const matrix: number[][] = [];
    for (let i = 0; i < numericCols.length; i++) {
        const rowCorr: number[] = [];
        for (let j = 0; j < numericCols.length; j++) {
            if (i === j) { rowCorr.push(1); } else {
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

export const createCalculatedColumn = (dataset: Dataset, newColName: string, formula: string): Dataset => {
    const usedColumns = dataset.columns.map(c => c.name).filter(name => formula.includes(name));
    let func: Function;
    try {
       func = new Function(...usedColumns, `return ${formula};`);
    } catch (e) {
       console.error("Formula Parse Error", e);
       throw new Error("Invalid formula syntax");
    }
    const newRows = dataset.rows.map(row => {
        try {
           const args = usedColumns.map(colName => { const val = parseFloat(row[colName]); return isNaN(val) ? 0 : val; });
           const result = func(...args);
           return { ...row, [newColName]: isNaN(result) ? 0 : result };
        } catch (e) { return { ...row, [newColName]: 0 }; }
    });
    return { ...dataset, rows: newRows, columns: analyzeColumns(newRows), stats: dataset.stats };
};