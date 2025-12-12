import React, { useState, useMemo, useEffect } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, ZAxis
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Dataset, VizSuggestion } from '../types';
import { calculatePCA, PCAResult } from '../utils/pca';
import { getExplainableInsight, getVisualizationSuggestions } from '../services/geminiService';
import { Lightbulb, Maximize2, Map as MapIcon, BarChart2, Settings, MessageSquare, RefreshCcw, HelpCircle, ChevronRight, ChevronDown, Sparkles, Info } from 'lucide-react';

interface VisualizerProps {
  dataset: Dataset;
}

const Visualizer: React.FC<VisualizerProps> = ({ dataset }) => {
  const [activeTab, setActiveTab] = useState<'distribution' | 'pca' | 'map'>('distribution');
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [suggestions, setSuggestions] = useState<VizSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Custom Axis State
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [zAxis, setZAxis] = useState<string>(''); 
  const [showLoadings, setShowLoadings] = useState(true);

  // AI Editing State
  const [schemaDesc, setSchemaDesc] = useState(`Dataset with ${dataset.rows.length} rows and columns: ${dataset.columns.map(c=>c.name).join(', ')}.`);
  const [isEditingSchema, setIsEditingSchema] = useState(false);

  const numericCols = useMemo(() => dataset.columns.filter(c => c.type === 'number' && c.isActive), [dataset.columns]);

  // Set defaults
  useEffect(() => {
      if (numericCols.length > 0) {
          if(!xAxis) setXAxis('PCA1');
          if(!yAxis) setYAxis('PCA2');
      }
  }, [numericCols]);

  const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      const res = await getVisualizationSuggestions(dataset.columns, dataset.rows.slice(0, 5));
      setSuggestions(res);
      setLoadingSuggestions(false);
  };

  const applySuggestion = (s: VizSuggestion) => {
      if (s.type === 'scatter') {
          setActiveTab('pca'); // repurpose PCA tab for generic scatter
          setXAxis(s.x);
          setYAxis(s.y);
          if(s.z) setZAxis(s.z);
      } else if (s.type === 'map') {
          setActiveTab('map');
      } else {
          setActiveTab('distribution');
      }
  };

  // -- PCA / Scatter Logic --
  const pcaResult: PCAResult = useMemo(() => {
    if ((xAxis === 'PCA1' || yAxis === 'PCA2' || yAxis === 'PCA1' || xAxis === 'PCA2')) {
        const MAX_POINTS = 2000;
        let rowsToProcess = dataset.rows;
        if (rowsToProcess.length > MAX_POINTS) {
            const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
            rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
        }
        return calculatePCA(rowsToProcess, numericCols.map(c => c.name));
    }
    return { data: [], loadings: { pc1: [], pc2: [] } };
  }, [dataset, xAxis, yAxis, numericCols]);

  const plotData = useMemo(() => {
    if (activeTab !== 'pca') return [];
    
    const MAX_POINTS = 2000;
    let rowsToProcess = dataset.rows;
    if (rowsToProcess.length > MAX_POINTS) {
       const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
       rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
    }

    if (pcaResult.data.length > 0 && (xAxis.startsWith('PCA') || yAxis.startsWith('PCA'))) {
        return pcaResult.data;
    }

    return rowsToProcess.map(r => ({
        x: Number(r[xAxis]) || 0,
        y: Number(r[yAxis]) || 0,
        z: zAxis ? (Number(r[zAxis]) || 1) : 1,
        id: r.id,
        ...r
    }));
  }, [dataset, activeTab, xAxis, yAxis, zAxis, numericCols, pcaResult]);

  // -- Map Logic --
  const mapData = useMemo(() => {
    const latCol = dataset.columns.find(c => /lat/i.test(c.name));
    const lonCol = dataset.columns.find(c => /lon|lng/i.test(c.name));
    if (!latCol || !lonCol) return [];
    return dataset.rows.filter(r => r[latCol.name] && r[lonCol.name]).map(r => ({ ...r, lat: parseFloat(r[latCol.name]), lng: parseFloat(r[lonCol.name]) })).slice(0, 1000);
  }, [dataset]);

  const generateInsight = async () => {
    setLoadingInsight(true);
    let context = activeTab === 'pca' ? `Scatter: ${xAxis} vs ${yAxis}.` : activeTab === 'map' ? "Geospatial." : "Distribution";
    const text = await getExplainableInsight(context + ` User Context: ${schemaDesc}`, `Sample size: ${dataset.rows.length}`);
    setInsight(text);
    setLoadingInsight(false);
  };

  // -- Renderers --
  const renderControls = () => {
      if (activeTab !== 'pca') return null;
      return (
          <div className="flex gap-4 mb-4 p-4 bg-slate-900 border border-slate-800 rounded-lg flex-wrap items-end relative">
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">X Axis</label>
                  <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="PCA1">Automatic (PCA 1)</option>
                      <option value="PCA2">Automatic (PCA 2)</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.humanLabel || c.name}</option>)}
                  </select>
              </div>
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">Y Axis</label>
                  <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="PCA1">Automatic (PCA 1)</option>
                      <option value="PCA2">Automatic (PCA 2)</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.humanLabel || c.name}</option>)}
                  </select>
              </div>
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">Size (Z)</label>
                  <select value={zAxis} onChange={e => setZAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="">None</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.humanLabel || c.name}</option>)}
                  </select>
              </div>

              {/* Suggestions Panel */}
              <div className="ml-auto flex items-center gap-2">
                  {suggestions.length === 0 && (
                      <button onClick={fetchSuggestions} disabled={loadingSuggestions} className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                          <Sparkles size={12} /> {loadingSuggestions ? "Thinking..." : "Suggest Views"}
                      </button>
                  )}
              </div>
          </div>
      );
  }

  const renderTooltipContent = (loadings: { name: string, value: number }[], label: string) => (
      <div className="p-3 w-56">
          <strong className="text-indigo-300 block mb-2 border-b border-slate-700 pb-1 text-[10px] uppercase tracking-wide">{label} Drivers</strong>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {loadings.slice(0, 5).map(l => (
                  <div key={l.name} className="flex flex-col gap-0.5 group">
                      <div className="flex justify-between text-[10px] text-slate-300">
                        <span className="truncate w-full font-medium" title={l.name}>{l.name}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden flex">
                          <div className={`h-full ${l.value > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.abs(l.value) * 100}%`, marginLeft: l.value < 0 ? 'auto' : '0' }} />
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const AxisTitle: React.FC<{ label: string, loadings: any[], orientation: 'horizontal' | 'vertical' }> = ({ label, loadings, orientation }) => (
      <div className={`flex items-center justify-center gap-2 group/axis cursor-help bg-slate-800/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 shadow-lg hover:border-indigo-500 transition-colors pointer-events-auto ${orientation === 'vertical' ? '-rotate-90 origin-center whitespace-nowrap' : ''}`}>
          <span className="text-xs font-bold text-slate-300">{label}</span>
          <Info size={12} className="text-slate-500 group-hover/axis:text-indigo-400" />
          
          {/* Tooltip Popup */}
          <div className={`absolute z-[100] hidden group-hover/axis:block bg-slate-900 border border-slate-700 rounded-lg shadow-xl ${orientation === 'vertical' ? 'left-full top-1/2 -translate-y-1/2 ml-4 rotate-90 origin-center' : 'bottom-full left-1/2 -translate-x-1/2 mb-2'}`}>
              {/* Reset rotation for vertical tooltip content */}
              <div className={orientation === 'vertical' ? '-rotate-90' : ''}>
                 {renderTooltipContent(loadings, label)}
              </div>
          </div>
      </div>
  );

  const renderPCA = () => {
    if (plotData.length === 0) return <div className="p-10 text-center text-slate-500">Insufficient numeric data.</div>;
    return (
      <div className="h-full w-full relative">
          
         {/* Chart Layer */}
         <div className="absolute inset-0 pb-8 pl-8">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" dataKey="x" stroke="#94a3b8" tick={{fontSize: 12}} label="" />
                    <YAxis type="number" dataKey="y" stroke="#94a3b8" tick={{fontSize: 12}} label="" />
                    {zAxis && <ZAxis type="number" dataKey="z" range={[50, 400]} name={zAxis} />}
                    <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        content={({ payload }) => {
                            if (payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-xs max-w-xs z-[50]">
                                        <p className="font-bold mb-1 text-white border-b border-slate-600 pb-1">ID: {data.id}</p>
                                        <p className="text-indigo-300">{xAxis}: <span className="text-white">{data.x.toFixed(2)}</span></p>
                                        <p className="text-indigo-300">{yAxis}: <span className="text-white">{data.y.toFixed(2)}</span></p>
                                        {zAxis && <p className="text-indigo-300">{zAxis}: <span className="text-white">{data.z}</span></p>}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Scatter name="Items" data={plotData} fill="#8884d8">
                        {plotData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'][index % 4]} />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
         </div>

         {/* Overlay Axis Titles */}
         {(xAxis.startsWith('PCA')) && (
            <div className="absolute bottom-1 left-8 right-0 flex justify-center pointer-events-none">
                 <AxisTitle 
                    label={`X Axis: ${xAxis} Contributors`} 
                    loadings={xAxis === 'PCA1' ? pcaResult.loadings.pc1 : pcaResult.loadings.pc2} 
                    orientation="horizontal"
                 />
            </div>
         )}

         {(yAxis.startsWith('PCA')) && (
            <div className="absolute top-0 bottom-8 left-0 flex items-center justify-center w-8 pointer-events-none">
                 <div className="relative">
                     <AxisTitle 
                        label={`Y Axis: ${yAxis} Contributors`} 
                        loadings={yAxis === 'PCA1' ? pcaResult.loadings.pc1 : pcaResult.loadings.pc2} 
                        orientation="vertical"
                     />
                 </div>
            </div>
         )}
      </div>
    );
  };

  const renderDistribution = () => {
    const numCol = dataset.columns.find(c => c.type === 'number' && c.isActive);
    if (!numCol) return <div className="p-10 text-center text-slate-500">No numeric data to visualize.</div>;
    const data = dataset.rows.slice(0, 50).map((r, i) => ({ name: `Row ${i}`, value: Number(r[numCol.name]) }));

    return (
        <div className="h-full w-full">
            <h4 className="mb-4 text-center text-slate-400">Values for {numCol.humanLabel || numCol.name} (First 50)</h4>
            <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" hide />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#6366f1" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
  };

  const renderMap = () => {
      if (mapData.length === 0) return <div className="flex flex-col items-center justify-center h-full text-slate-500"><MapIcon size={48} className="mb-4 opacity-50" /><p>No geospatial coordinates (lat/lon) found.</p></div>;
      const center: [number, number] = [mapData[0].lat, mapData[0].lng]; // simplified center
      return (
        <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%', background: '#0f172a' }}>
            <TileLayer attribution='&copy; OSM' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {mapData.map((point) => (
                <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={5} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.7, weight: 1 }}>
                    <Popup><div className="text-slate-900 text-xs"><strong>ID: {point.id}</strong></div></Popup>
                </CircleMarker>
            ))}
        </MapContainer>
      );
  };

  return (
    <div className="flex flex-col h-full gap-4">
        {/* Top Bar with Tabs */}
        <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('distribution')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'distribution' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><BarChart2 size={16} /> Basic</button>
                <button onClick={() => setActiveTab('pca')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'pca' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Maximize2 size={16} /> Scatter / PCA</button>
                <button onClick={() => setActiveTab('map')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><MapIcon size={16} /> Map</button>
            </div>
        </div>

        {/* AI Suggestions Row */}
        {suggestions.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
                {suggestions.map((s, i) => (
                    <button key={i} onClick={() => applySuggestion(s)} className="shrink-0 bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg text-left hover:bg-indigo-900/50 transition-colors w-64 group">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={12} className="text-indigo-400 group-hover:animate-spin" />
                            <span className="text-xs font-bold text-indigo-200">{s.title}</span>
                        </div>
                        <p className="text-[10px] text-indigo-300/70">{s.reason}</p>
                    </button>
                ))}
            </div>
        )}

        {renderControls()}

        <div className="flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 p-4 relative overflow-hidden flex flex-col">
            <div className="flex-1 relative">
                {activeTab === 'distribution' && renderDistribution()}
                {activeTab === 'pca' && renderPCA()}
                {activeTab === 'map' && renderMap()}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-start gap-4">
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2"><MessageSquare size={12} /> Data Context</label>
                        <button onClick={() => setIsEditingSchema(!isEditingSchema)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Settings size={12} /> {isEditingSchema ? 'Close' : 'Edit'}</button>
                    </div>
                    {isEditingSchema ? <textarea className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-sm p-2 rounded h-20" value={schemaDesc} onChange={(e) => setSchemaDesc(e.target.value)} /> : <p className="text-xs text-slate-400 truncate">{schemaDesc}</p>}
                 </div>
                 <button onClick={generateInsight} disabled={loadingInsight} className="h-full px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all">{loadingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <Lightbulb size={18} />} <span className="font-medium text-sm">Explain</span></button>
            </div>
            {insight && <div className="mt-4 bg-slate-800/50 p-4 rounded-lg border-l-2 border-emerald-500 animate-in slide-in-from-bottom-2"><p className="text-slate-200 text-sm leading-relaxed">{insight}</p></div>}
        </div>
    </div>
  );
};

export default Visualizer;