import React, { useMemo, useState } from 'react';
import { Dataset } from '../types';
import { Hash, Type, AlertCircle, BarChart3, TrendingUp, X, Check, BrainCircuit, Calculator, Table2 } from 'lucide-react';
import { calculateCorrelationMatrix, createCalculatedColumn } from '../utils/dataProcessing';

interface AnalyticsProps {
  dataset: Dataset;
  onUpdateDataset: (d: Dataset) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ dataset, onUpdateDataset }) => {
  const [activeTab, setActiveTab] = useState<'health' | 'features'>('health');
  
  // Feature Engineering State
  const [newColName, setNewColName] = useState('');
  const [formula, setFormula] = useState('');

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
    
    onUpdateDataset({ ...dataset, rows: newRows });
  };

  const handleCreateFeature = () => {
      if(!newColName || !formula) return;
      try {
          const newData = createCalculatedColumn(dataset, newColName, formula);
          onUpdateDataset(newData);
          setNewColName('');
          setFormula('');
          alert(`Column ${newColName} created!`);
      } catch (e) {
          alert("Error in formula. Use valid Javascript syntax and column names.");
      }
  };

  // Memoized Calculations
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

  const correlation = useMemo(() => {
      if (activeTab === 'features') return calculateCorrelationMatrix(dataset);
      return { cols: [], matrix: [] };
  }, [dataset, activeTab]);

  const activeCols = dataset.columns.filter(c => c.isActive);

  // -- Views --

  const renderHealthView = () => (
      <div className="flex flex-col gap-6">
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
            
            {/* Column List */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300">Detailed Column Stats</h3>
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
                        </div>
                    ))}
                </div>
            </div>
      </div>
  );

  const renderFeaturesView = () => (
      <div className="flex flex-col gap-8">
           {/* Calculated Columns */}
           <div>
               <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                    <Calculator className="text-indigo-400" />
                    Feature Engineering
                </h2>
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="col-span-1">
                            <label className="text-xs text-slate-500 font-bold mb-1 block">New Column Name</label>
                            <input 
                                value={newColName} 
                                onChange={e => setNewColName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                                placeholder="e.g. TotalCost"
                            />
                        </div>
                        <div className="col-span-2">
                             <label className="text-xs text-slate-500 font-bold mb-1 block">Formula (JS Syntax)</label>
                             <div className="flex gap-2">
                                <input 
                                    value={formula} 
                                    onChange={e => setFormula(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm font-mono text-indigo-300"
                                    placeholder="e.g. Price * Quantity + log(Tax)"
                                />
                                <button 
                                    onClick={handleCreateFeature}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded text-sm font-medium whitespace-nowrap"
                                >
                                    Create Feature
                                </button>
                             </div>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500">
                        Supported: Standard operators (+, -, *, /), Math functions (log, abs, pow, sqrt), and any numeric column names as variables.
                        <br/>
                        Example: <code className="text-slate-400">Math.log(Income) + Bonus</code>
                    </div>
                </div>
           </div>

           {/* Correlation Matrix */}
           <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                    <Table2 className="text-indigo-400" />
                    Correlation Matrix
                </h2>
                {correlation.cols.length > 1 ? (
                    <div className="overflow-x-auto bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <table className="w-full text-xs">
                            <thead>
                                <tr>
                                    <th className="w-20"></th>
                                    {correlation.cols.map(c => (
                                        <th key={c} className="p-2 text-center text-slate-400 font-normal w-20 truncate" title={c}>{c.substring(0,8)}...</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {correlation.matrix.map((row, i) => (
                                    <tr key={i}>
                                        <td className="p-2 font-medium text-slate-400 text-right truncate" title={correlation.cols[i]}>{correlation.cols[i].substring(0,8)}...</td>
                                        {row.map((val, j) => {
                                            const intensity = Math.abs(val);
                                            const color = val > 0 ? `rgba(99, 102, 241, ${intensity})` : `rgba(239, 68, 68, ${intensity})`; // Indigo vs Red
                                            return (
                                                <td key={j} className="p-1 text-center border border-slate-800" style={{ backgroundColor: color }}>
                                                    <span className="relative z-10 text-white drop-shadow-md">{val.toFixed(2)}</span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
                        Need at least 2 numeric columns for correlation analysis.
                    </div>
                )}
           </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col gap-6">
        {/* Navigation */}
        <div className="flex gap-4 border-b border-slate-800 pb-2">
            <button 
                onClick={() => setActiveTab('health')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
                Health & Overview
            </button>
            <button 
                onClick={() => setActiveTab('features')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'features' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
                Features & Correlations
            </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-10">
            {activeTab === 'health' ? renderHealthView() : renderFeaturesView()}
        </div>
    </div>
  );
};

export default Analytics;