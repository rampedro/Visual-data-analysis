import React, { useMemo, useState } from 'react';
import { Dataset } from '../types';
import { Gauge, Layers } from 'lucide-react';
import { calculateCorrelationMatrix } from '../utils/dataProcessing';

interface AnalyticsProps {
  dataset: Dataset;
  onUpdateDataset: (d: Dataset) => void;
  setAssistantOverride: (msg: string) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ dataset }) => {
  const [activeTab, setActiveTab] = useState<'health'>('health');
  
  // Stats logic
  const activeCols = dataset.columns.filter(c => c.isActive);
  const totalCells = dataset.rows.length * activeCols.length;
  const missingCells = activeCols.reduce((a, b) => a + b.missingCount, 0);
  const completeness = totalCells > 0 ? (1 - (missingCells / totalCells)) * 100 : 0;
  const fidelity = totalCells > 0 ? (1 - (dataset.stats.imputedCells / totalCells)) * 100 : 100;
  const correlation = useMemo(() => calculateCorrelationMatrix(dataset), [dataset]);

  const renderHealthView = () => (
      <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900 p-4 rounded border border-slate-800">
                   <span className="text-xs text-slate-500 uppercase flex items-center gap-2"><Gauge size={14}/> Completeness</span>
                   <div className="text-2xl font-bold text-emerald-400 mt-1">{Math.round(completeness)}%</div>
               </div>
               <div className="bg-slate-900 p-4 rounded border border-slate-800">
                   <span className="text-xs text-slate-500 uppercase flex items-center gap-2"><Layers size={14}/> Fidelity</span>
                   <div className="text-2xl font-bold text-blue-400 mt-1">{Math.round(fidelity)}%</div>
               </div>
           </div>
           <div className="bg-slate-900 p-4 rounded border border-slate-800">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Correlation Matrix</h3>
                {correlation.cols.length > 1 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr><th className="w-10"></th>{correlation.cols.map(c => <th key={c} className="p-1 text-slate-500 w-16 truncate">{c.substring(0,5)}</th>)}</tr></thead>
                            <tbody>{correlation.matrix.map((row, i) => <tr key={i}><td className="p-1 text-slate-500 truncate">{correlation.cols[i].substring(0,5)}</td>{row.map((val, j) => {
                                const intensity = Math.abs(val);
                                return <td key={j} className="p-1 text-center" style={{backgroundColor: val > 0 ? `rgba(99, 102, 241, ${intensity})` : `rgba(239, 68, 68, ${intensity})`}}>{val.toFixed(1)}</td>
                            })}</tr>)}</tbody>
                        </table>
                    </div>
                ) : <p className="text-xs text-slate-500">Not enough numeric data.</p>}
           </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col gap-6">
        <div className="flex gap-4 border-b border-slate-800 pb-2">
            <button onClick={() => setActiveTab('health')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Health & Stats</button>
        </div>
        <div className="flex-1 overflow-hidden">{renderHealthView()}</div>
    </div>
  );
};

export default Analytics;