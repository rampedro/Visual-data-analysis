import React, { useMemo } from 'react';
import { Dataset, ColumnMetadata } from '../types';
import { Hash, Type, AlertCircle, BarChart3, TrendingUp, X, Check, BrainCircuit } from 'lucide-react';

interface AnalyticsProps {
  dataset: Dataset;
  onUpdateDataset: (d: Dataset) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ dataset, onUpdateDataset }) => {
  
  // Interactive Actions
  const handleDropColumn = (colName: string) => {
    const newCols = dataset.columns.map(c => c.name === colName ? { ...c, isActive: false } : c);
    onUpdateDataset({ ...dataset, columns: newCols });
  };

  const handleImpute = (colName: string, method: 'mean' | 'zero') => {
    const col = dataset.columns.find(c => c.name === colName);
    if (!col || col.type !== 'number') return;
    
    const newVal = method === 'mean' && col.mean ? col.mean : 0;
    
    const newRows = dataset.rows.map(r => {
        if (r[colName] === null || r[colName] === undefined || r[colName] === '') {
            return { ...r, [colName]: newVal };
        }
        return r;
    });
    
    // Recalculate stats for this column would be ideal here, simplified for now
    onUpdateDataset({ ...dataset, rows: newRows });
  };

  // Generate Suggestions
  const suggestions = useMemo(() => {
    const activeCols = dataset.columns.filter(c => c.isActive);
    const list: { id: string, title: string, desc: string, action: () => void, icon: any }[] = [];

    activeCols.forEach(col => {
        const missingPct = col.missingCount / dataset.rows.length;
        
        if (missingPct > 0.8) {
            list.push({
                id: `drop-${col.name}`,
                title: `Drop ${col.name}`,
                desc: `${(missingPct * 100).toFixed(0)}% missing. Low information value.`,
                action: () => handleDropColumn(col.name),
                icon: X
            });
        } else if (missingPct > 0 && col.type === 'number') {
            list.push({
                id: `impute-${col.name}`,
                title: `Impute ${col.name}`,
                desc: `${col.missingCount} missing values detected. Fill with Mean?`,
                action: () => handleImpute(col.name, 'mean'),
                icon: BrainCircuit
            });
        }
        
        if (col.uniqueCount === 1) {
             list.push({
                id: `drop-unique-${col.name}`,
                title: `Drop ${col.name}`,
                desc: `Only 1 unique value ("${dataset.rows[0][col.name]}"). Adds no variance.`,
                action: () => handleDropColumn(col.name),
                icon: X
            });
        }
    });
    return list;
  }, [dataset]);

  const activeCols = dataset.columns.filter(c => c.isActive);

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Left Col: Overview & Health */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="text-indigo-400" />
                Data Health & Statistics
            </h2>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider relative z-10">Active Rows</span>
                    <p className="text-2xl font-bold text-slate-100 mt-1 relative z-10">{dataset.rows.length.toLocaleString()}</p>
                    <div className="absolute -right-4 -bottom-4 text-slate-800 opacity-50"><Hash size={64} /></div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Active Columns</span>
                    <p className="text-2xl font-bold text-slate-100 mt-1">{activeCols.length}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Numeric</span>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">
                        {activeCols.filter(c => c.type === 'number').length}
                    </p>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Completeness</span>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {Math.round((1 - (activeCols.reduce((a, b) => a + b.missingCount, 0) / (dataset.rows.length * activeCols.length))) * 100)}%
                    </p>
                </div>
            </div>

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-indigo-200 mb-4 flex items-center gap-2">
                        <BrainCircuit size={20} /> AI Recommendations
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {suggestions.map(s => (
                            <div key={s.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 flex justify-between items-center group hover:border-indigo-500 transition-all">
                                <div>
                                    <h4 className="font-medium text-slate-200 text-sm">{s.title}</h4>
                                    <p className="text-xs text-slate-400">{s.desc}</p>
                                </div>
                                <button 
                                    onClick={s.action}
                                    className="p-2 bg-slate-800 rounded-full hover:bg-indigo-600 hover:text-white transition-colors text-slate-400"
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Feature Importance / Columns */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300">Feature Importance & Distribution</h3>
                <div className="space-y-3">
                    {activeCols.map((col) => (
                        <div key={col.name} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                        col.type === 'number' ? 'bg-indigo-500/10 text-indigo-400' : 
                                        col.type === 'date' ? 'bg-green-500/10 text-green-400' :
                                        'bg-slate-700/30 text-slate-400'
                                    }`}>
                                        {col.type === 'number' ? <Hash size={16} /> : 
                                         col.type === 'string' ? <Type size={16} /> : 
                                         <AlertCircle size={16} />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-200 text-sm">{col.name}</h4>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                     {/* Simple Importance Bar */}
                                     {col.type === 'number' && (
                                         <div className="flex items-center gap-2" title="Approx. Entropy/Variance">
                                            <TrendingUp size={14} className="text-slate-600" />
                                            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500" 
                                                    style={{ width: `${Math.min(100, (col.importanceScore || 0) * 100)}%` }}
                                                />
                                            </div>
                                         </div>
                                     )}
                                    <button 
                                        onClick={() => handleDropColumn(col.name)}
                                        className="text-slate-600 hover:text-red-400"
                                        title="Hide Column"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-4 text-xs mt-3 pt-3 border-t border-slate-800/50">
                                <div className="text-slate-500">Unique: <span className="text-slate-300 ml-1">{col.uniqueCount}</span></div>
                                <div className="text-slate-500">Missing: <span className="text-red-400 ml-1">{col.missingCount}</span></div>
                                {col.type === 'number' && (
                                    <>
                                        <div className="text-slate-500">Min: <span className="text-slate-300 ml-1">{col.min?.toFixed(1)}</span></div>
                                        <div className="text-slate-500">Max: <span className="text-slate-300 ml-1">{col.max?.toFixed(1)}</span></div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Right Col: Configuration / Filters (Sticky) */}
        <div className="hidden lg:flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit sticky top-0">
             <h3 className="font-semibold text-slate-200">Analysis Configuration</h3>
             <p className="text-sm text-slate-400">
                Adjusting these settings will affect calculations and visualizations globally.
             </p>
             
             <div className="space-y-2">
                 <label className="text-xs font-semibold text-slate-500 uppercase">Imputation Strategy</label>
                 <select className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded-md p-2">
                     <option>Ignore Missing Rows</option>
                     <option>Fill with Mean/Mode</option>
                     <option>Fill with Zero/Unknown</option>
                 </select>
             </div>

             <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 text-xs text-blue-300">
                 Tip: Use the "Data Inspection" tab to transpose rows/columns if the structure seems inverted.
             </div>
        </div>

    </div>
  );
};

export default Analytics;