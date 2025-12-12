import React, { useState, useMemo } from 'react';
import { Dataset, TransformationType, TransformationConfig } from '../types';
import DataGrid from './DataGrid';
import { applyTransformation, suggestTransformations, joinDatasets } from '../utils/dataProcessing';
import { Wand2, Split, CaseSensitive, Regex, Calculator, Layers, ArrowRight, Sparkles, Eye, ArrowRightCircle, Link, Network, Database, ChevronRight, ChevronLeft, Wrench } from 'lucide-react';

interface WorkspaceProps {
  dataset: Dataset;
  availableDatasets: Dataset[]; // For binding/merging
  onUpdateDataset: (d: Dataset) => void;
  setAssistantOverride: (msg: string) => void;
}

type Tab = 'transform' | 'bind' | 'hierarchy';

const Workspace: React.FC<WorkspaceProps> = ({ dataset, availableDatasets, onUpdateDataset, setAssistantOverride }) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('transform');
  
  // Transform State
  const [selectedCol, setSelectedCol] = useState<string>('');
  const [activeTransform, setActiveTransform] = useState<TransformationType>('split_count');
  const [params, setParams] = useState<Record<string, any>>({});

  // Bind State
  const [secondaryDatasetId, setSecondaryDatasetId] = useState<string>('');
  const [primaryKey, setPrimaryKey] = useState<string>('');
  const [secondaryKey, setSecondaryKey] = useState<string>('');

  // Hierarchy State
  const [hierarchyName, setHierarchyName] = useState('New Hierarchy');
  const [hierarchyLevels, setHierarchyLevels] = useState<string[]>([]);
  const [hierarchyLevelSelect, setHierarchyLevelSelect] = useState('');

  // Heuristic Suggestions
  const suggestions = useMemo(() => {
      if (!selectedCol) return [];
      const col = dataset.columns.find(c => c.name === selectedCol);
      if (!col) return [];
      const samples = dataset.rows.slice(0, 10).map(r => r[selectedCol]);
      return suggestTransformations(col, samples);
  }, [selectedCol, dataset]);

  // Preview Logic
  const previewData = useMemo(() => {
      if (!toolsOpen || activeTab !== 'transform' || !selectedCol) return [];
      const config: TransformationConfig = { type: activeTransform, targetCol: selectedCol, params };
      
      const miniDataset = { ...dataset, rows: dataset.rows.slice(0, 3) };
      try {
          const transformed = applyTransformation(miniDataset, config);
          const newCol = transformed.columns.find(c => !dataset.columns.find(oc => oc.name === c.name));
          if (!newCol) return [];
          
          return miniDataset.rows.map((row, i) => ({
              original: String(row[selectedCol]),
              transformed: String(transformed.rows[i][newCol.name])
          }));
      } catch (e) {
          return [];
      }
  }, [dataset, selectedCol, activeTransform, params, activeTab, toolsOpen]);

  const handleApplyTransform = () => {
      if (!selectedCol) return;
      const config: TransformationConfig = {
          type: activeTransform,
          targetCol: selectedCol,
          params: params
      };
      const newData = applyTransformation(dataset, config);
      onUpdateDataset(newData);
      setAssistantOverride(`Applied ${activeTransform} on ${selectedCol}.`);
  };

  const handleBind = () => {
      if (!secondaryDatasetId || !primaryKey || !secondaryKey) return;
      const secondary = availableDatasets.find(d => d.id === secondaryDatasetId);
      if (!secondary) return;

      if(window.confirm(`Merge "${secondary.name}" into "${dataset.name}" using keys ${primaryKey} = ${secondaryKey}?`)) {
          const merged = joinDatasets(dataset, secondary, primaryKey, secondaryKey);
          onUpdateDataset(merged);
          setAssistantOverride(`Merged datasets successfully. New columns added.`);
      }
  };

  const handleAddHierarchyLevel = () => {
      if(hierarchyLevelSelect && !hierarchyLevels.includes(hierarchyLevelSelect)) {
          setHierarchyLevels([...hierarchyLevels, hierarchyLevelSelect]);
          setHierarchyLevelSelect('');
      }
  };

  const handleSaveHierarchy = () => {
      if(hierarchyLevels.length === 0) return;
      onUpdateDataset({
          ...dataset,
          hierarchy: {
              name: hierarchyName,
              levels: hierarchyLevels
          }
      });
      setAssistantOverride(`Hierarchy "${hierarchyName}" created with ${hierarchyLevels.length} levels. Go to "Visualize" -> Treemap to see it.`);
  };

  const renderTransformForm = () => {
    switch (activeTransform) {
      case 'split_count':
      case 'split_extract':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Delimiter</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                placeholder="e.g. , or |"
                value={params.delimiter || ''}
                onChange={(e) => setParams({ ...params, delimiter: e.target.value })}
              />
            </div>
            {activeTransform === 'split_extract' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Index (0-based)</label>
                <input
                  type="number"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                  value={params.index || 0}
                  onChange={(e) => setParams({ ...params, index: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        );
      case 'extract_regex':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Regex Pattern (Capture Group)</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                placeholder="e.g. (\w+)"
                value={params.regex || ''}
                onChange={(e) => setParams({ ...params, regex: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">New Column Suffix</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                placeholder="e.g. Extracted"
                value={params.name || ''}
                onChange={(e) => setParams({ ...params, name: e.target.value })}
              />
            </div>
          </div>
        );
      case 'math_add':
        return (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Value to Add</label>
            <input
              type="number"
              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
              value={params.value || 0}
              onChange={(e) => setParams({ ...params, value: Number(e.target.value) })}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full gap-4 relative">
        {/* Main Data Grid - Expands when tools are closed */}
        <div className="flex-1 min-w-0 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative z-10 transition-all">
             <DataGrid dataset={dataset} onUpdateDataset={onUpdateDataset} />
             
             {/* Toggle Button for Tools */}
             {!toolsOpen && (
                 <button 
                    onClick={() => setToolsOpen(true)}
                    className="absolute top-4 right-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-500 transition-transform hover:scale-105 z-50"
                    title="Open Tools"
                 >
                     <Wrench size={18} />
                 </button>
             )}
        </div>

        {/* Side Tool Panel - Collapsible */}
        <div className={`${toolsOpen ? 'w-80' : 'w-0'} bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shrink-0 shadow-xl transition-all duration-300 relative`}>
            {toolsOpen && (
                <div className="absolute top-2 right-2 z-50">
                    <button onClick={() => setToolsOpen(false)} className="text-slate-500 hover:text-white p-1">
                        <ChevronRight />
                    </button>
                </div>
            )}
            
            <div className="flex border-b border-slate-800">
                <button onClick={() => setActiveTab('transform')} className={`flex-1 p-3 text-xs font-bold flex flex-col items-center gap-1 transition-colors ${activeTab === 'transform' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Wand2 size={16} /> Transform
                </button>
                <button onClick={() => setActiveTab('bind')} className={`flex-1 p-3 text-xs font-bold flex flex-col items-center gap-1 transition-colors ${activeTab === 'bind' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Link size={16} /> Bind Data
                </button>
                <button onClick={() => setActiveTab('hierarchy')} className={`flex-1 p-3 text-xs font-bold flex flex-col items-center gap-1 transition-colors ${activeTab === 'hierarchy' ? 'text-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Network size={16} /> Hierarchy
                </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                
                {/* --- TRANSFORM TAB --- */}
                {activeTab === 'transform' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">1. Target Column</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={selectedCol}
                                onChange={(e) => { setSelectedCol(e.target.value); setParams({}); }}
                            >
                                <option value="">-- Select Variable --</option>
                                {dataset.columns.map(c => (
                                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                                ))}
                            </select>
                        </div>

                        {suggestions.length > 0 && (
                            <div className="bg-indigo-900/20 border border-indigo-500/20 rounded p-3 animate-in fade-in">
                                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1 mb-2"><Sparkles size={12}/> AI Suggestions</span>
                                <div className="space-y-2">
                                    {suggestions.map((s, i) => (
                                        <button 
                                            key={i} 
                                            className="w-full text-left bg-indigo-900/40 hover:bg-indigo-900/60 p-2 rounded text-xs text-indigo-200 border border-indigo-500/30 transition-colors"
                                            onClick={() => {
                                                setActiveTransform(s.type);
                                                setParams(s.params);
                                            }}
                                        >
                                            {s.type === 'split_count' && `Count items split by "${s.params.delimiter}"`}
                                            {s.type === 'extract_regex' && `Extract ${s.params.name}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">2. Operation</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setActiveTransform('split_count')} className={`p-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all ${activeTransform === 'split_count' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                    <Split size={14} /> Split #
                                </button>
                                <button onClick={() => setActiveTransform('split_extract')} className={`p-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all ${activeTransform === 'split_extract' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                    <ArrowRight size={14} /> Split At
                                </button>
                                <button onClick={() => setActiveTransform('to_uppercase')} className={`p-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all ${activeTransform === 'to_uppercase' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                    <CaseSensitive size={14} /> Upper
                                </button>
                                <button onClick={() => setActiveTransform('math_log')} className={`p-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all ${activeTransform === 'math_log' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                    <Calculator size={14} /> Log(x)
                                </button>
                                <button onClick={() => setActiveTransform('extract_regex')} className={`p-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all ${activeTransform === 'extract_regex' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                    <Regex size={14} /> Regex
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 bg-slate-950/50 p-3 rounded border border-slate-800">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">3. Configure</label>
                            {renderTransformForm() || <span className="text-xs text-slate-600 italic">No parameters needed.</span>}
                        </div>

                        {previewData.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2"><Eye size={12}/> Live Preview</label>
                                <div className="bg-slate-950 border border-slate-800 rounded text-xs p-2 space-y-1">
                                    {previewData.map((row, i) => (
                                        <div key={i} className="flex items-center gap-2 text-slate-500">
                                            <span className="truncate max-w-[40%] text-slate-400" title={row.original}>{row.original}</span>
                                            <ArrowRightCircle size={10} className="text-indigo-500 shrink-0" />
                                            <span className="truncate max-w-[40%] text-emerald-400 font-mono" title={row.transformed}>{row.transformed}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={handleApplyTransform}
                            disabled={!selectedCol}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            Apply Transformation
                        </button>
                    </>
                )}

                {/* --- BIND/MERGE TAB --- */}
                {activeTab === 'bind' && (
                    <div className="space-y-6">
                        <div className="p-3 bg-slate-800/50 rounded border border-indigo-500/30 text-xs text-slate-300">
                            Combine the current dataset with another loaded dataset by matching a common column (Key).
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">1. Dataset to Bind</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200"
                                value={secondaryDatasetId}
                                onChange={(e) => setSecondaryDatasetId(e.target.value)}
                            >
                                <option value="">-- Select Dataset --</option>
                                {availableDatasets.filter(d => d.id !== dataset.id).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">2. Current Dataset Key</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200"
                                value={primaryKey}
                                onChange={(e) => setPrimaryKey(e.target.value)}
                            >
                                <option value="">-- Select Key Column --</option>
                                {dataset.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">3. Other Dataset Key</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200"
                                value={secondaryKey}
                                onChange={(e) => setSecondaryKey(e.target.value)}
                                disabled={!secondaryDatasetId}
                            >
                                <option value="">-- Select Key Column --</option>
                                {availableDatasets.find(d => d.id === secondaryDatasetId)?.columns.map(c => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                )) || []}
                            </select>
                        </div>

                        <button 
                            onClick={handleBind}
                            disabled={!secondaryDatasetId || !primaryKey || !secondaryKey}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50"
                        >
                            Merge Datasets
                        </button>
                    </div>
                )}

                {/* --- HIERARCHY TAB --- */}
                {activeTab === 'hierarchy' && (
                    <div className="space-y-6">
                        <div className="p-3 bg-slate-800/50 rounded border border-indigo-500/30 text-xs text-slate-300">
                            Define a parent-child structure (e.g., Region {'>'} Country {'>'} City) to enable Treemap and Sunburst visualizations.
                        </div>
                        
                        <div>
                             <label className="text-xs font-bold text-slate-400 uppercase">Hierarchy Name</label>
                             <input type="text" value={hierarchyName} onChange={e => setHierarchyName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white mt-1" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Add Level</label>
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200"
                                    value={hierarchyLevelSelect}
                                    onChange={(e) => setHierarchyLevelSelect(e.target.value)}
                                >
                                    <option value="">-- Select Column --</option>
                                    {dataset.columns.map(c => (
                                        <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                                    ))}
                                </select>
                                <button onClick={handleAddHierarchyLevel} className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded">+</button>
                            </div>
                        </div>

                        <div className="bg-slate-950 rounded p-3 min-h-[100px] border border-slate-800">
                             <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Current Levels (Top to Bottom)</span>
                             {hierarchyLevels.length === 0 ? <p className="text-slate-600 text-xs italic">No levels added.</p> : (
                                 <div className="flex flex-col gap-2">
                                     {hierarchyLevels.map((lvl, i) => (
                                         <div key={i} className="flex items-center gap-2 text-sm text-indigo-300 bg-slate-900 p-2 rounded border border-slate-700">
                                             <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">{i+1}</div>
                                             {lvl}
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>

                        <button 
                            onClick={handleSaveHierarchy}
                            disabled={hierarchyLevels.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50"
                        >
                            Build Hierarchy
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Workspace;