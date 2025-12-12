import React from 'react';
import { Dataset } from '../types';
import { Hash, Type, AlertCircle, BarChart3 } from 'lucide-react';

interface AnalyticsProps {
  dataset: Dataset;
}

const Analytics: React.FC<AnalyticsProps> = ({ dataset }) => {
  return (
    <div className="h-full overflow-y-auto pr-2">
        <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" />
            Statistical Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Total Rows</span>
                <p className="text-2xl font-bold text-slate-100 mt-1">{dataset.rows.length.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Total Columns</span>
                <p className="text-2xl font-bold text-slate-100 mt-1">{dataset.columns.length}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Numeric Fields</span>
                <p className="text-2xl font-bold text-indigo-400 mt-1">
                    {dataset.columns.filter(c => c.type === 'number').length}
                </p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Completeness</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {Math.round((1 - (dataset.columns.reduce((a, b) => a + b.missingCount, 0) / (dataset.rows.length * dataset.columns.length))) * 100)}%
                </p>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-300 mb-4">Column Details</h3>
            {dataset.columns.map((col) => (
                <div key={col.name} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                                col.type === 'number' ? 'bg-indigo-500/10 text-indigo-400' : 
                                col.type === 'date' ? 'bg-green-500/10 text-green-400' :
                                'bg-slate-700/30 text-slate-400'
                            }`}>
                                {col.type === 'number' ? <Hash size={18} /> : 
                                 col.type === 'string' ? <Type size={18} /> : 
                                 <AlertCircle size={18} />}
                            </div>
                            <div>
                                <h4 className="font-medium text-slate-200">{col.name}</h4>
                                <span className="text-xs text-slate-500 uppercase">{col.type}</span>
                            </div>
                        </div>
                        {col.missingCount > 0 && (
                            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                                {col.missingCount} missing
                            </span>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                        <div className="flex justify-between text-slate-400">
                            <span>Unique Values:</span>
                            <span className="text-slate-200">{col.uniqueCount}</span>
                        </div>
                        {col.type === 'number' && (
                            <>
                                <div className="flex justify-between text-slate-400">
                                    <span>Mean:</span>
                                    <span className="text-slate-200">{col.mean?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Min:</span>
                                    <span className="text-slate-200">{col.min?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Max:</span>
                                    <span className="text-slate-200">{col.max?.toFixed(2)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default Analytics;