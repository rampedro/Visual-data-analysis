import React, { useMemo, useState } from 'react';
import { Dataset } from '../types';
import { Hash, Type, AlertCircle, BarChart3, Info, X, Check, BrainCircuit, Calculator, Table2, FileJson, Gauge, Layers, MousePointerClick, Copy } from 'lucide-react';
import { calculateCorrelationMatrix, createCalculatedColumn } from '../utils/dataProcessing';

interface AnalyticsProps {
  dataset: Dataset;
  onUpdateDataset: (d: Dataset) => void;
  setAssistantOverride: (msg: string) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ dataset, onUpdateDataset, setAssistantOverride }) => {
  const [activeTab, setActiveTab] = useState<'health' | 'features'>('health');
  const [newColName, setNewColName] = useState('');
  const [formula, setFormula] = useState('');

  // Actions
  const handleDropColumn = (colName: string) => {
    const newCols = dataset.columns.map(c => c.name === colName ? { ...c, isActive: false } : c);
    onUpdateDataset({ ...dataset, columns: newCols });
  };

  const handleImpute = (colName: string, method: 'mean' | 'zero') => {
    const col = dataset.columns.find(c => c.name === colName);
    if (!col || col.type !== 'number') return;
    
    const newVal = method === 'mean' && col.mean ? col.mean : 0;
    let imputedCount = 0;
    
    const newRows = dataset.rows.map(r => {
        if (r[colName] === null || r[colName] === undefined || r[colName] === '') {
            imputedCount++;
            return { ...r, [colName]: newVal };
        }
        return r;
    });
    
    onUpdateDataset({ 
        ...dataset, 
        rows: newRows, 
        stats: { ...dataset.stats, imputedCells: dataset.stats.imputedCells + imputedCount }
    });
  };

  const handleCreateFeature = () => {
      if(!newColName || !formula) return;
      try {
          const newData = createCalculatedColumn(dataset, newColName, formula);
          onUpdateDataset(newData);
          setNewColName('');
          setFormula('');
          alert("Column created successfully!");
      } catch (e) {
          alert("Error in formula. Check column names and syntax.");
      }
  };

  // Metrics
  const activeCols = dataset.columns.filter(c => c.isActive);
  const totalCells = dataset.rows.length * activeCols.length;
  const missingCells = activeCols.reduce((a, b) => a + b.missingCount, 0);
  const completeness = totalCells > 0 ? (1 - (missingCells / totalCells)) * 100 : 0;
  
  // Fidelity
  const fidelity = totalCells > 0 ? (1 - (dataset.stats.imputedCells / totalCells)) * 100 : 100;

  const suggestions = useMemo(() => {
    const list: { id: string, title: string, desc: string, action: () => void, icon: any }[] = [];

    activeCols.forEach(col => {
        const missingPct = col.missingCount / dataset.rows.length;
        if (missingPct > 0.8) {
            list.push({ id: `drop-${col.name}`, title: `Drop ${col.name}`, desc: `${(missingPct * 100).toFixed(0)}% missing.`, action: () => handleDropColumn(col.name), icon: X });
        } else if (missingPct > 0 && col.type === 'number') {
            list.push({ id: `impute-${col.name}`, title: `Impute ${col.name}`, desc: `Fill ${col.missingCount} missing values with mean?`, action: () => handleImpute(col.name, 'mean'), icon: BrainCircuit });
        }
    });
    return list;
  }, [dataset, activeCols]);

  const structuringHints = useMemo(() => {
      const hints = [];
      const colNames = dataset.columns.map(c => c.name.toLowerCase());
      if (colNames.some(c => c.includes('lat')) && colNames.some(c => c.includes('lon'))) {
          hints.push({ type: 'GeoJSON', desc: 'Latitude/Longitude columns detected. This data can be structured as GeoJSON for map visualizations.' });
      }
      if (dataset.rows.length > 5000) {
          hints.push({ type: 'Arrow/Parquet', desc: 'Large dataset detected (>5k rows). Converting to columnar formats like Apache Arrow will speed up visualization.' });
      }
      return hints;
  }, [dataset]);

  const correlation = useMemo(() => activeTab === 'features' ? calculateCorrelationMatrix(dataset) : { cols: [], matrix: [] }, [dataset, activeTab]);

  const handleCorrelationHover = (val: number, col1: string, col2: string) => {
      let desc = "No linear correlation.";
      if (val > 0.7) desc = "Strong Positive Correlation: As one increases, the other tends to increase.";
      else if (val > 0.3) desc = "Weak Positive Correlation.";
      else if (val < -0.7) desc = "Strong Negative Correlation: As one increases, the other decreases.";
      else if (val < -0.3) desc = "Weak Negative Correlation.";
      
      setAssistantOverride(`Correlation ${val.toFixed(2)} between ${col1} and ${col2}. ${desc}`);
  };

  const renderHealthView = () => (
      <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden group">
                     <span className="text-slate-500 text-xs uppercase font-bold tracking-wider relative z-10 flex items-center gap-2">
                         <Gauge size={14} className="text-emerald-400" /> Completeness
                     </span>
                     <p className="text-3xl font-bold text-slate-100 mt-2 relative z-10">{Math.round(completeness)}%</p>
                     <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000" style={{ width: `${completeness}%` }}></div>
                     <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 p-2 text-[10px] rounded shadow-xl hidden group-hover:block z-50">
                         Percentage of non-null cells. Higher is better for analysis.
                     </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden group">
                     <span className="text-slate-500 text-xs uppercase font-bold tracking-wider relative z-10 flex items-center gap-2">
                         <Layers size={14} className="text-blue-400" /> Fidelity
                     </span>
                     <p className="text-3xl font-bold text-slate-100 mt-2 relative z-10">{Math.round(fidelity)}%</p>
                     <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${fidelity}%` }}></div>
                     <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 p-2 text-[10px] rounded shadow-xl hidden group-hover:block z-50">
                         Represents original data preservation. Drops when you impute values.
                     </div>
                </div>
                 <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Rows / Dropped</span>
                    <p className="text-2xl font-bold text-slate-100 mt-1">
                        {dataset.rows.length.toLocaleString()} <span className="text-xs text-red-400 font-normal">(-{dataset.stats.droppedRows})</span>
                    </p>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Active Columns</span>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">{activeCols.length}</p>
                </div>
            </div>

            {structuringHints.length > 0 && (
                <div className="bg-slate-900/50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
                    <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2 mb-2"><FileJson size={16} /> Structuring Suggestions</h3>
                    <div className="space-y-2">
                        {structuringHints.map((hint, i) => (
                            <div key={i} className="text-xs text-slate-300"><strong className="text-slate-100">{hint.type}:</strong> {hint.desc}</div>
                        ))}
                    </div>
                </div>
            )}

            {suggestions.length > 0 && (
                <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-indigo-200 mb-4 flex items-center gap-2"><BrainCircuit size={20} /> AI Recommendations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {suggestions.map(s => (
                            <div key={s.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 flex justify-between items-center group hover:border-indigo-500 transition-all">
                                <div><h4 className="font-medium text-slate-200 text-sm">{s.title}</h4><p className="text-xs text-slate-400">{s.desc}</p></div>
                                <button onClick={s.action} className="p-2 bg-slate-800 rounded-full hover:bg-indigo-600 hover:text-white transition-colors text-slate-400"><Check size={16} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300">Detailed Column Stats</h3>
                <div className="space-y-3">
                    {activeCols.map((col) => (
                        <div key={col.name} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${col.type === 'number' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-700/30 text-slate-400'}`}>
                                        {col.type === 'number' ? <Hash size={16} /> : <Type size={16} />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-200 text-sm">{col.humanLabel || col.name}</h4>
                                        <div className="text-[10px] text-slate-500 font-mono">{col.name}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                     {col.missingCount > 0 && (
                                         <div className="text-xs text-amber-500 flex items-center gap-1">
                                             <AlertCircle size={12} />
                                             {col.missingCause || "Missing data"}
                                         </div>
                                     )}
                                     {col.type === 'number' && (
                                         <div className="flex items-center gap-2 group/score relative">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Variance Score</span>
                                            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (col.importanceScore || 0) * 100)}%` }} />
                                            </div>
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/score:block bg-slate-800 border border-slate-700 p-2 rounded w-48 z-50 text-[10px] text-slate-300 shadow-xl">
                                                Estimate of information content based on value distribution (variance/entropy).
                                            </div>
                                         </div>
                                     )}
                                    <button onClick={() => handleDropColumn(col.name)} className="text-slate-600 hover:text-red-400"><X size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
      </div>
  );

  const renderFeaturesView = () => (
      <div className="flex flex-col gap-8">
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4"><Calculator className="text-indigo-400" size={20} /> Feature Engineering</h2>
                
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 font-bold mb-1 block">New Column Name</label>
                            <input value={newColName} onChange={e => setNewColName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="e.g. TotalCost" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold mb-1 block">Formula (JavaScript)</label>
                            <div className="flex gap-2">
                                <textarea value={formula} onChange={e => setFormula(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm font-mono text-indigo-300 h-24" placeholder="e.g. Price * Quantity + Math.log(Tax)" />
                            </div>
                        </div>
                        <button onClick={handleCreateFeature} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap">Create Derived Column</button>
                    </div>

                    {/* Reference Variables Panel */}
                    <div className="w-full lg:w-64 bg-slate-950 border border-slate-800 rounded-lg p-3">
                         <span className="text-xs font-bold text-slate-500 uppercase mb-2 block border-b border-slate-800 pb-2">Available Variables</span>
                         <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                             {activeCols.map(c => (
                                 <div key={c.name} className="flex justify-between items-center group cursor-pointer hover:bg-slate-900 p-1 rounded" onClick={() => setFormula(prev => prev + c.name)}>
                                     <span className="text-xs text-indigo-300 font-mono truncate max-w-[140px]" title={c.name}>{c.name}</span>
                                     <span className="text-[10px] text-slate-600 uppercase">{c.type}</span>
                                     <Copy size={10} className="text-slate-600 opacity-0 group-hover:opacity-100" />
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
           </div>
           <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4"><Table2 className="text-indigo-400" size={20} /> Correlation Matrix <MousePointerClick size={14} className="text-slate-500 ml-2" /></h2>
                {correlation.cols.length > 1 ? (
                    <div className="overflow-x-auto bg-slate-900 p-4 rounded-xl border border-slate-800" onMouseLeave={() => setAssistantOverride('')}>
                        <table className="w-full text-xs">
                            <thead><tr><th className="w-20"></th>{correlation.cols.map(c => <th key={c} className="p-2 text-center text-slate-400 font-normal w-20 truncate" title={c}>{c.substring(0,8)}...</th>)}</tr></thead>
                            <tbody>{correlation.matrix.map((row, i) => <tr key={i}><td className="p-2 font-medium text-slate-400 text-right truncate" title={correlation.cols[i]}>{correlation.cols[i].substring(0,8)}...</td>{row.map((val, j) => {
                                const intensity = Math.abs(val);
                                const color = val > 0 ? `rgba(99, 102, 241, ${intensity})` : `rgba(239, 68, 68, ${intensity})`;
                                return <td 
                                        key={j} 
                                        className="p-1 text-center border border-slate-800 hover:border-white cursor-help transition-colors" 
                                        style={{ backgroundColor: color }}
                                        onMouseEnter={() => handleCorrelationHover(val, correlation.cols[i], correlation.cols[j])}
                                    >
                                    <span className="relative z-10 text-white drop-shadow-md">{val.toFixed(2)}</span>
                                </td>
                            })}</tr>)}</tbody>
                        </table>
                    </div>
                ) : <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">Correlation matrix requires at least 2 numeric columns. Use Feature Engineering above to create numeric features from existing data.</div>}
           </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col gap-6">
        <div className="flex gap-4 border-b border-slate-800 pb-2">
            <button onClick={() => setActiveTab('health')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Health & Overview</button>
            <button onClick={() => setActiveTab('features')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'features' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Features & Correlations</button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 pb-10">{activeTab === 'health' ? renderHealthView() : renderFeaturesView()}</div>
    </div>
  );
};

export default Analytics;