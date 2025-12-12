import React, { useState, useMemo } from 'react';
import { Dataset, DataRow, ColumnMetadata } from '../types';
import { Search, ChevronLeft, ChevronRight, Edit2, RotateCw, ArrowDownToLine, EyeOff, LayoutList, Table as TableIcon } from 'lucide-react';
import { transposeDataset, setHeaderRow } from '../utils/dataProcessing';

interface DataGridProps {
  dataset: Dataset;
  onUpdateDataset: (d: Dataset) => void;
}

const PAGE_SIZE = 50;

const DataGrid: React.FC<DataGridProps> = ({ dataset, onUpdateDataset }) => {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [editingCol, setEditingCol] = useState<string | null>(null);

  const activeColumns = useMemo(() => dataset.columns.filter(c => c.isActive), [dataset.columns]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return dataset.rows;
    const lower = searchTerm.toLowerCase();
    return dataset.rows.filter(r => 
      activeColumns.some(c => String(r[c.name]).toLowerCase().includes(lower))
    );
  }, [dataset.rows, activeColumns, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Actions
  const handleRenameCol = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) {
        setEditingCol(null);
        return;
    }
    const newCols = dataset.columns.map(c => c.name === oldName ? { ...c, name: newName } : c);
    
    // Update rows to match new key
    const newRows = dataset.rows.map(r => {
        const newR = { ...r };
        newR[newName] = newR[oldName];
        delete newR[oldName];
        return newR;
    });

    onUpdateDataset({ ...dataset, columns: newCols, rows: newRows });
    setEditingCol(null);
  };

  const toggleColumnActive = (colName: string) => {
    const newCols = dataset.columns.map(c => c.name === colName ? { ...c, isActive: !c.isActive } : c);
    onUpdateDataset({ ...dataset, columns: newCols });
  };

  const handleSetHeader = (rowId: number | string) => {
    // Find absolute index
    const index = dataset.rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    if (window.confirm("This will discard all rows above this line and use this row as the header. Continue?")) {
        const newData = setHeaderRow(dataset, index);
        onUpdateDataset(newData);
        setPage(0);
    }
  };

  const handleTranspose = () => {
    if (dataset.rows.length > 500) {
        if (!window.confirm("Transposing large datasets may be slow. Continue?")) return;
    }
    onUpdateDataset(transposeDataset(dataset));
    setPage(0);
  };

  // Renderers
  const renderTreeView = () => (
    <div className="p-4 space-y-4">
        {visibleRows.map(row => (
            <div key={row.id} className="bg-slate-900 border border-slate-800 rounded p-4 font-mono text-sm">
                <div className="text-indigo-400 mb-2 font-bold">ID: {row.id}</div>
                <div className="pl-4 border-l border-slate-700 space-y-1">
                    {activeColumns.map(col => (
                        <div key={col.name} className="flex gap-2">
                            <span className="text-slate-500 w-32 shrink-0 truncate text-right">{col.name}:</span>
                            <span className="text-slate-200 break-all">{String(row[col.name])}</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden shadow-sm border border-slate-800">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-900">
        <div className="flex items-center gap-4">
            <h3 className="font-semibold text-slate-200">Data Editor</h3>
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button 
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Table View"
                >
                    <TableIcon size={16} />
                </button>
                <button 
                    onClick={() => setViewMode('tree')}
                    className={`p-1.5 rounded ${viewMode === 'tree' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Hierarchical/Tree View"
                >
                    <LayoutList size={16} />
                </button>
            </div>
            <button 
                onClick={handleTranspose}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors"
                title="Swap Rows and Columns"
            >
                <RotateCw size={14} /> Transpose
            </button>
        </div>

        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
                type="text" 
                placeholder="Search values..." 
                className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-950">
        {viewMode === 'tree' ? renderTreeView() : (
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
            <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                <tr>
                <th className="p-2 border-b border-slate-800 w-10 text-center text-xs text-slate-600">#</th>
                {activeColumns.map(col => (
                    <th key={col.name} className="p-4 font-medium text-slate-200 border-b border-slate-800 whitespace-nowrap min-w-[180px] group relative hover:bg-slate-800 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                            {editingCol === col.name ? (
                                <input 
                                    autoFocus
                                    className="bg-slate-950 text-white px-1 py-0.5 rounded border border-indigo-500 w-full"
                                    defaultValue={col.name}
                                    onBlur={(e) => handleRenameCol(col.name, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameCol(col.name, e.currentTarget.value)}
                                />
                            ) : (
                                <div className="flex items-center gap-2" onDoubleClick={() => setEditingCol(col.name)}>
                                    <span className="cursor-text">{col.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${
                                        col.type === 'number' ? 'bg-blue-500/20 text-blue-400' :
                                        col.type === 'date' ? 'bg-green-500/20 text-green-400' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                        {col.type}
                                    </span>
                                </div>
                            )}
                            
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setEditingCol(col.name)}
                                    className="p-1 hover:text-indigo-400"
                                    title="Rename"
                                >
                                    <Edit2 size={12} />
                                </button>
                                <button 
                                    onClick={() => toggleColumnActive(col.name)}
                                    className="p-1 hover:text-red-400"
                                    title="Hide Column"
                                >
                                    <EyeOff size={12} />
                                </button>
                            </div>
                        </div>
                    </th>
                ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
                {visibleRows.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-900 transition-colors group">
                    <td className="p-2 text-center text-xs text-slate-600 relative">
                        <div className="group-hover:hidden">{page * PAGE_SIZE + index + 1}</div>
                        <button 
                            onClick={() => handleSetHeader(row.id)}
                            className="hidden group-hover:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white p-1 rounded hover:scale-110"
                            title="Use as Header Row"
                        >
                            <ArrowDownToLine size={12} />
                        </button>
                    </td>
                    {activeColumns.map(col => (
                    <td key={`${row.id}-${col.name}`} className="p-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs border-r border-transparent hover:border-slate-800">
                        {String(row[col.name] ?? '')}
                    </td>
                    ))}
                </tr>
                ))}
            </tbody>
            </table>
        )}
      </div>

      {/* Pagination */}
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