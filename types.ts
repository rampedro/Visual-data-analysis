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

export interface HierarchyDefinition {
    name: string;
    levels: string[]; // Column names in order of depth
}

export interface Dataset {
  id: string; // Unique ID for the DataRefine structure
  parentId?: string; // If this is a 'view' or copy, point to parent
  name: string;
  rows: DataRow[];
  columns: ColumnMetadata[];
  stats: DatasetStats;
  created: number;
  hierarchy?: HierarchyDefinition; // User defined hierarchy
}

export enum ViewState {
  UPLOAD = 'UPLOAD',
  WORKSPACE = 'WORKSPACE', // Combined Clean & Analyze
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
  type: 'bar' | 'scatter' | 'map' | 'treemap';
  x: string;
  y: string;
  z?: string; // size or color
}

// New Types for No-Code Transformations
export type TransformationType = 
  | 'split_count' 
  | 'split_extract' 
  | 'extract_regex' 
  | 'to_uppercase' 
  | 'to_lowercase'
  | 'math_add'
  | 'math_log'
  | 'nlp_sentiment' // Simulated
  | 'group_count';

export interface TransformationConfig {
  type: TransformationType;
  targetCol: string;
  params: Record<string, any>; // e.g. { delimiter: ',' } or { regex: '...' }
}

export interface AIProviderConfig {
    provider: 'gemini' | 'local';
    localEndpoint?: string; // e.g. http://localhost:11434/v1
    apiKey?: string;
    modelName?: string;
}

export type DimReductionAlgo = 'PCA' | 't-SNE' | 'UMAP';