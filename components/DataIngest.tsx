import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, ArrowRight, Loader2, Table, FileJson } from 'lucide-react';
import { Dataset, ColumnMetadata } from '../types';
import { parseCSV, parseGeoJSON, convertColumnType } from '../utils/dataProcessing';

interface DataIngestProps {
  onDataLoaded: (data: Dataset) => void;
}

type Step = 'upload' | 'parsing' | 'review';

const DataIngest: React.FC<DataIngestProps> = ({ onDataLoaded }) => {
  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState(0);
  const [tempDataset, setTempDataset] = useState<Dataset | null>(null);

  const handleFile = async (file: File) => {
    setStep('parsing');
    setProgress(10);
    try {
      let dataset;
      if (file.name.endsWith('.csv')) {
          dataset = await parseCSV(file, (percent) => setProgress(percent));
      } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
          setProgress(50);
          dataset = await parseGeoJSON(file);
          setProgress(100);
      } else {
          throw new Error("Unsupported format");
      }
      setTempDataset(dataset);
      setStep('review');
    } catch (error) {
      console.error("Failed to parse", error);
      alert("Failed to parse file. Ensure it is valid CSV or GeoJSON.");
      setStep('upload');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
  }, []);

  const handleTypeChange = (colName: string, newType: 'string' | 'number') => {
      if(!tempDataset) return;
      const updated = convertColumnType(tempDataset, colName, newType);
      setTempDataset(updated);
  };

  const finalize = () => {
      if(tempDataset) onDataLoaded(tempDataset);
  };

  // --- Step 1: Upload ---
  if (step === 'upload') {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in duration-500">
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
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Upload Data</h2>
            <p className="text-slate-400 mb-8">Drag & drop CSV or GeoJSON. High-performance loading enabled.</p>
            
            <input 
                type="file" 
                id="file-input" 
                className="hidden" 
                accept=".csv,.json,.geojson"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <div className="flex gap-4 justify-center text-sm text-slate-500 mt-8">
                <span className="flex items-center gap-2"><FileText size={16}/> CSV</span>
                <span className="flex items-center gap-2"><FileJson size={16}/> GeoJSON</span>
                <span className="flex items-center gap-2"><AlertTriangle size={16}/> Ill-structured</span>
            </div>
        </div>
        </div>
    );
  }

  // --- Step 2: Processing ---
  if (step === 'parsing') {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-2xl">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Processing Data</h3>
                  <p className="text-sm text-slate-400 mb-6">Converting to optimized internal format...</p>
                  
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300 ease-out" 
                        style={{ width: `${progress}%` }}
                      ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                      <span>Buffered Stream</span>
                      <span>{progress}%</span>
                  </div>
              </div>
          </div>
      );
  }

  // --- Step 3: Review & Schema ---
  return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
              <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2"><CheckCircle2 className="text-emerald-400" /> Data Ready for Review</h2>
                  <p className="text-slate-400 text-sm mt-1">{tempDataset?.rows.length.toLocaleString()} rows detected. Review inferred types below.</p>
              </div>
              <button onClick={finalize} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all">
                  Load Workspace <ArrowRight size={18} />
              </button>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-slate-950 p-3 border-b border-slate-800 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Table size={16} /> Schema Preview (First 5 Rows)
              </div>
              
              <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-sm text-slate-400 border-collapse">
                      <thead className="bg-slate-900 sticky top-0 z-10">
                          <tr>
                              {tempDataset?.columns.map(col => (
                                  <th key={col.name} className="p-4 border-b border-slate-800 min-w-[150px]">
                                      <div className="flex flex-col gap-2">
                                          <span className="text-slate-200 font-medium">{col.name}</span>
                                          <select 
                                            className={`text-xs p-1 rounded border bg-slate-950 outline-none ${col.type === 'number' ? 'border-blue-500/50 text-blue-400' : 'border-slate-700 text-slate-400'}`}
                                            value={col.type}
                                            onChange={(e) => handleTypeChange(col.name, e.target.value as 'string'|'number')}
                                          >
                                              <option value="string">Text (String)</option>
                                              <option value="number">Number (Int/Float)</option>
                                          </select>
                                      </div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                          {tempDataset?.rows.slice(0, 5).map(row => (
                              <tr key={row.id}>
                                  {tempDataset.columns.map(col => (
                                      <td key={col.name} className="p-4 whitespace-nowrap border-r border-transparent hover:border-slate-800">
                                          {String(row[col.name] || '')}
                                      </td>
                                  ))}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );
};

export default DataIngest;