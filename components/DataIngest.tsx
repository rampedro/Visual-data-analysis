import React, { useCallback } from 'react';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import { Dataset } from '../types';
import { parseCSV } from '../utils/dataProcessing';

interface DataIngestProps {
  onDataLoaded: (data: Dataset) => void;
}

const DataIngest: React.FC<DataIngestProps> = ({ onDataLoaded }) => {
  const handleFile = async (file: File) => {
    try {
      const dataset = await parseCSV(file);
      onDataLoaded(dataset);
    } catch (error) {
      console.error("Failed to parse", error);
      alert("Failed to parse CSV. It might be too ill-structured.");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.includes('csv') || file.name.endsWith('.csv')) {
        handleFile(file);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in duration-700">
      <div 
        className="w-full max-w-2xl border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50 p-12 text-center hover:border-indigo-500 hover:bg-slate-900/80 transition-all cursor-pointer group"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-500/10 rounded-full group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Upload your Dataset</h2>
        <p className="text-slate-400 mb-8">Drag and drop your CSV file here, or click to browse.</p>
        
        <input 
            type="file" 
            id="file-input" 
            className="hidden" 
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex gap-4 justify-center text-sm text-slate-500 mt-8">
            <span className="flex items-center gap-2"><FileText size={16}/> Standard CSV</span>
            <span className="flex items-center gap-2"><AlertTriangle size={16}/> Ill-structured Data</span>
        </div>
      </div>
      
      <p className="mt-8 text-slate-600 text-sm max-w-md text-center">
        Our AI-powered engine will attempt to repair broken lines and suggest type conversions automatically.
      </p>
    </div>
  );
};

export default DataIngest;