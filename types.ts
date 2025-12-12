export interface DataRow {
  [key: string]: any;
  id: string | number;
}

export interface ColumnMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'unknown';
  missingCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  categories?: string[];
}

export interface Dataset {
  name: string;
  rows: DataRow[];
  columns: ColumnMetadata[];
  rawContent?: string;
}

export enum ViewState {
  UPLOAD = 'UPLOAD',
  CLEAN = 'CLEAN',
  ANALYZE = 'ANALYZE',
  VISUALIZE = 'VISUALIZE'
}

export interface ProcessingSuggestion {
  column: string;
  suggestion: string;
  reason: string;
  actionType: 'impute' | 'normalize' | 'drop' | 'convert_type' | 'extract';
}