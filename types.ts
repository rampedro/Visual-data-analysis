export interface DataRow {
  [key: string]: any;
  id: string | number;
}

export interface ColumnMetadata {
  name: string;
  originalName?: string; // To track renames
  humanLabel?: string; // AI generated readable name
  description?: string; // AI generated description
  missingCause?: string; // AI hypothesis on why it is missing
  type: 'string' | 'number' | 'boolean' | 'date' | 'unknown';
  missingCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  isActive: boolean; // For filtering analysis
  importanceScore?: number; // Calculated importance
  categories?: string[];
}

export interface DatasetStats {
  originalRows: number;
  totalCells: number;
  imputedCells: number;
  droppedRows: number;
}

export interface Dataset {
  name: string;
  rows: DataRow[];
  columns: ColumnMetadata[];
  stats: DatasetStats;
  rawContent?: string;
}

export enum ViewState {
  UPLOAD = 'UPLOAD',
  CLEAN = 'CLEAN',
  ANALYZE = 'ANALYZE',
  VISUALIZE = 'VISUALIZE'
}

export interface ProcessingSuggestion {
  id: string;
  column: string;
  suggestion: string;
  reason: string;
  actionType: 'impute' | 'normalize' | 'drop' | 'convert_type' | 'extract';
}

export interface VizSuggestion {
  title: string;
  reason: string;
  type: 'bar' | 'scatter' | 'map';
  x: string;
  y: string;
  z?: string; // size or color
}