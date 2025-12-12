import React, { useState, useMemo, useEffect } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, ZAxis
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Dataset } from '../types';
import { calculatePCA, PCAResult } from '../utils/pca';
import { getExplainableInsight } from '../services/geminiService';
import { Lightbulb, Maximize2, Map as MapIcon, BarChart2, Settings, MessageSquare, RefreshCcw, HelpCircle } from 'lucide-react';

interface VisualizerProps {
  dataset: Dataset;
}

const Visualizer: React.FC<VisualizerProps> = ({ dataset }) => {
  const [activeTab, setActiveTab] = useState<'distribution' | 'pca' | 'map'>('distribution');
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  
  // Custom Axis State
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [zAxis, setZAxis] = useState<string>(''); // Size

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

  // -- PCA / Scatter Logic --
  const pcaResult: PCAResult = useMemo(() => {
    // Only calculate if PCA mode selected
    if (activeTab === 'pca' && (xAxis === 'PCA1' || yAxis === 'PCA2' || yAxis === 'PCA1' || xAxis === 'PCA2')) {
        // Sample data for performance
        const MAX_POINTS = 2000;
        let rowsToProcess = dataset.rows;
        if (rowsToProcess.length > MAX_POINTS) {
            const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
            rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
        }
        return calculatePCA(rowsToProcess, numericCols.map(c => c.name));
    }
    return { data: [], loadings: { pc1: [], pc2: [] } };
  }, [dataset, activeTab, xAxis, yAxis, numericCols]);

  const plotData = useMemo(() => {
    if (activeTab !== 'pca') return [];
    
    // Performance optimization: Sample data
    const MAX_POINTS = 2000;
    let rowsToProcess = dataset.rows;
    if (rowsToProcess.length > MAX_POINTS) {
       const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
       rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
    }

    // Using PCA result
    if (pcaResult.data.length > 0 && (xAxis.startsWith('PCA') || yAxis.startsWith('PCA'))) {
        return pcaResult.data;
    }

    // Custom Scatter (Raw Columns)
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
    // Try to find lat/lon columns
    const latCol = dataset.columns.find(c => /lat/i.test(c.name));
    const lonCol = dataset.columns.find(c => /lon|lng/i.test(c.name));
    
    if (!latCol || !lonCol) return [];
    
    return dataset.rows
      .filter(r => r[latCol.name] && r[lonCol.name])
      .map(r => ({
        ...r,
        lat: parseFloat(r[latCol.name]),
        lng: parseFloat(r[lonCol.name])
      }))
      .slice(0, 1000); // Limit for performance
  }, [dataset]);

  // -- Insight Generation --
  const generateInsight = async () => {
    setLoadingInsight(true);
    let context = '';
    let summary = '';

    if (activeTab === 'pca') {
        context = `Scatter Plot: ${xAxis} vs ${yAxis}.`;
        summary = `Analyzing relationship between ${xAxis} and ${yAxis}.`;
    } else if (activeTab === 'map') {
        context = "Geospatial distribution.";
        summary = `Map showing ${mapData.length} points.`;
    } else {
        context = "General Data Distribution";
    }

    const text = await getExplainableInsight(context + ` User Context: ${schemaDesc}`, summary);
    setInsight(text);
    setLoadingInsight(false);
  };

  // -- Renderers --

  const renderControls = () => {
      if (activeTab !== 'pca') return null;
      return (
          <div className="flex gap-4 mb-4 p-4 bg-slate-900 border border-slate-800 rounded-lg flex-wrap items-end">
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">X Axis</label>
                  <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="PCA1">Automatic (PCA 1)</option>
                      <option value="PCA2">Automatic (PCA 2)</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
              </div>
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">Y Axis</label>
                  <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="PCA1">Automatic (PCA 1)</option>
                      <option value="PCA2">Automatic (PCA 2)</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
              </div>
              <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 font-bold">Size (Z)</label>
                  <select value={zAxis} onChange={e => setZAxis(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                      <option value="">None</option>
                      {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
              </div>
          </div>
      );
  }

  const renderDistribution = () => {
    const numCol = dataset.columns.find(c => c.type === 'number' && c.isActive);
    if (!numCol) return <div className="p-10 text-center text-slate-500">No numeric data to visualize.</div>;

    const data = dataset.rows.slice(0, 50).map((r, i) => ({
        name: `Row ${i}`,
        value: Number(r[numCol.name])
    }));

    return (
        <div className="h-full w-full">
            <h4 className="mb-4 text-center text-slate-400">Values for {numCol.name} (First 50)</h4>
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

  const renderLoadings = (loadings: { name: string, value: number }[], label: string) => (
      <div className="bg-slate-800/50 p-2 rounded text-[10px] w-48 shrink-0">
          <strong className="text-indigo-300 block mb-2">{label} Drivers</strong>
          <div className="space-y-1 max-h-40 overflow-y-auto">
              {loadings.slice(0, 5).map(l => (
                  <div key={l.name} className="flex justify-between">
                      <span className="truncate w-24" title={l.name}>{l.name}</span>
                      <span className={l.value > 0 ? "text-green-400" : "text-red-400"}>{l.value.toFixed(2)}</span>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderPCA = () => {
    if (plotData.length === 0) return <div className="p-10 text-center text-slate-500">Insufficient numeric data.</div>;
    return (
      <div className="h-full w-full relative flex">
         <div className="flex-1 h-full">
            <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" dataKey="x" name={xAxis} stroke="#94a3b8" tick={{fontSize: 12}} />
                <YAxis type="number" dataKey="y" name={yAxis} stroke="#94a3b8" tick={{fontSize: 12}} />
                {zAxis && <ZAxis type="number" dataKey="z" range={[50, 400]} name={zAxis} />}
                <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    content={({ payload }) => {
                        if (payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-xs">
                                    <p className="font-bold mb-1">ID: {data.id}</p>
                                    <p>{xAxis}: {data.x.toFixed(2)}</p>
                                    <p>{yAxis}: {data.y.toFixed(2)}</p>
                                    {zAxis && <p>{zAxis}: {data.z}</p>}
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

         {/* Loadings Panel (Explainable PCA) */}
         {(xAxis === 'PCA1' || xAxis === 'PCA2' || yAxis === 'PCA1' || yAxis === 'PCA2') && pcaResult.loadings.pc1.length > 0 && (
             <div className="absolute top-2 right-2 flex flex-col gap-2">
                 {xAxis === 'PCA1' && renderLoadings(pcaResult.loadings.pc1, "X-Axis (PC1)")}
                 {xAxis === 'PCA2' && renderLoadings(pcaResult.loadings.pc2, "X-Axis (PC2)")}
                 {yAxis === 'PCA1' && renderLoadings(pcaResult.loadings.pc1, "Y-Axis (PC1)")}
                 {yAxis === 'PCA2' && renderLoadings(pcaResult.loadings.pc2, "Y-Axis (PC2)")}
             </div>
         )}
      </div>
    );
  };

  const renderMap = () => {
    if (mapData.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <MapIcon size={48} className="mb-4 opacity-50" />
            <p>No geospatial coordinates (lat/lon) found in dataset.</p>
        </div>
    );
    const latSum = mapData.reduce((s, d) => s + d.lat, 0);
    const lngSum = mapData.reduce((s, d) => s + d.lng, 0);
    const center: [number, number] = [latSum / mapData.length, lngSum / mapData.length];

    return (
        <MapContainer center={center} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%', background: '#0f172a' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {mapData.map((point) => (
                <CircleMarker 
                    key={point.id} 
                    center={[point.lat, point.lng]} 
                    radius={5}
                    pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.7, weight: 1 }}
                >
                    <Popup>
                        <div className="text-slate-900 text-xs">
                            <strong>ID: {point.id}</strong><br/>
                            Lat: {point.lat.toFixed(4)}<br/>
                            Lng: {point.lng.toFixed(4)}
                        </div>
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
        {/* Controls */}
        <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
            <div className="flex gap-2">
                <button 
                    onClick={() => setActiveTab('distribution')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'distribution' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <BarChart2 size={16} /> Basic
                </button>
                <button 
                    onClick={() => setActiveTab('pca')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'pca' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Maximize2 size={16} /> Advanced Scatter
                </button>
                <button 
                    onClick={() => setActiveTab('map')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <MapIcon size={16} /> Geospatial
                </button>
            </div>
        </div>

        {renderControls()}

        {/* Chart Area */}
        <div className="flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 p-4 relative overflow-hidden flex flex-col">
            <div className="flex-1 relative">
                {activeTab === 'distribution' && renderDistribution()}
                {activeTab === 'pca' && renderPCA()}
                {activeTab === 'map' && renderMap()}
            </div>
            
            {/* AI Explanation Bar */}
            <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-start gap-4">
                     <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                                <MessageSquare size={12} /> Data Context for AI
                            </label>
                            <button 
                                onClick={() => setIsEditingSchema(!isEditingSchema)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                                <Settings size={12} /> {isEditingSchema ? 'Close' : 'Edit Context'}
                            </button>
                        </div>
                        
                        {isEditingSchema ? (
                            <textarea 
                                className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-sm p-2 rounded h-20"
                                value={schemaDesc}
                                onChange={(e) => setSchemaDesc(e.target.value)}
                            />
                        ) : (
                            <p className="text-xs text-slate-400 truncate">{schemaDesc}</p>
                        )}
                     </div>

                     <button 
                        onClick={generateInsight}
                        disabled={loadingInsight}
                        className="h-full px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                        {loadingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <Lightbulb size={18} />}
                        <span className="font-medium text-sm">Analyze View</span>
                    </button>
                </div>
                
                {insight && (
                    <div className="mt-4 bg-slate-800/50 p-4 rounded-lg border-l-2 border-emerald-500 animate-in slide-in-from-bottom-2">
                        <p className="text-slate-200 text-sm leading-relaxed">{insight}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Visualizer;