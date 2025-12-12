import React, { useState, useMemo } from 'react';
import { Dataset, DataRow } from '../types';
import { Search, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';

interface DataGridProps {
  dataset: Dataset;
}

const PAGE_SIZE = 50;

const DataGrid: React.FC<DataGridProps> = ({ dataset }) => {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchTerm) return dataset.rows;
    const lower = searchTerm.toLowerCase();
    return dataset.rows.filter(r => 
      dataset.columns.some(c => String(r[c.name]).toLowerCase().includes(lower))
    );
  }, [dataset, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-800">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 className="font-semibold text-slate-200">
            Data Preview <span className="text-slate-500 text-sm font-normal ml-2">({filteredRows.length} rows)</span>
        </h3>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
                type="text" 
                placeholder="Search data..." 
                className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 sticky top-0 z-10">
            <tr>
              {dataset.columns.map(col => (
                <th key={col.name} className="p-4 font-medium text-slate-200 border-b border-slate-800 whitespace-nowrap min-w-[150px]">
                  <div className="flex items-center gap-2">
                    {col.name}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        col.type === 'number' ? 'bg-blue-500/20 text-blue-400' :
                        col.type === 'date' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-700 text-slate-300'
                    }`}>
                        {col.type}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visibleRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                {dataset.columns.map(col => (
                  <td key={`${row.id}-${col.name}`} className="p-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                    {String(row[col.name] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
                <tr>
                    <td colSpan={dataset.columns.length} className="p-8 text-center text-slate-600">
                        No data found matching your search.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-900">
        <span className="text-xs text-slate-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
        </span>
        <div className="flex gap-2">
            <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
            >
                <ChevronLeft size={16} />
            </button>
            <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
            >
                <ChevronRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default DataGrid;