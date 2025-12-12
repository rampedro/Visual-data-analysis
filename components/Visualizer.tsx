import React, { useState, useMemo, useEffect } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, LineChart, Line, Cell
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Dataset } from '../types';
import { calculatePCA } from '../utils/pca';
import { getExplainableInsight } from '../services/geminiService';
import { Lightbulb, Maximize2, Map as MapIcon, BarChart2 } from 'lucide-react';

interface VisualizerProps {
  dataset: Dataset;
}

// Fix for default Leaflet icon issues in React
import L from 'leaflet';
// We are using CircleMarkers so we might not strictly need the default icon, but good to have if we extend.

const Visualizer: React.FC<VisualizerProps> = ({ dataset }) => {
  const [activeTab, setActiveTab] = useState<'distribution' | 'pca' | 'map'>('distribution');
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // -- PCA Logic --
  const pcaData = useMemo(() => {
    if (activeTab !== 'pca') return [];
    // Select numeric columns
    const numericCols = dataset.columns.filter(c => c.type === 'number').map(c => c.name);
    
    // Performance optimization: Sample data if dataset is too large for client-side PCA/SVG rendering
    // This prevents browser freeze on large CSVs
    const MAX_POINTS = 2000;
    let rowsToProcess = dataset.rows;
    
    if (rowsToProcess.length > MAX_POINTS) {
       const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
       rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
    }

    return calculatePCA(rowsToProcess, numericCols);
  }, [dataset, activeTab]);

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
        context = "PCA Scatter Plot of the dataset.";
        summary = `Plotting ${pcaData.length} points (sampled) reduced to 2 dimensions. x-axis variance: high, y-axis variance: secondary. Clusters indicate similar data points.`;
    } else if (activeTab === 'map') {
        context = "Geospatial distribution.";
        summary = `Map showing ${mapData.length} points.`;
    } else {
        context = "General Data Distribution";
        summary = `Dataset has ${dataset.rows.length} rows.`;
    }

    const text = await getExplainableInsight(context, summary);
    setInsight(text);
    setLoadingInsight(false);
  };

  useEffect(() => {
    setInsight(''); // Reset on tab change
  }, [activeTab]);


  // -- Renderers --

  const renderDistribution = () => {
    // Pick first numeric column for a simple histogram-like bar chart
    const numCol = dataset.columns.find(c => c.type === 'number');
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
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                    />
                    <Bar dataKey="value" fill="#6366f1" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
  };

  const renderPCA = () => {
    if (pcaData.length === 0) return <div className="p-10 text-center text-slate-500">Insufficient numeric data for PCA.</div>;
    return (
      <div className="h-full w-full relative">
         <h4 className="absolute top-0 left-0 text-xs text-slate-500 font-mono bg-slate-900/80 p-1 rounded">
             PC1 (x) vs PC2 (y) {dataset.rows.length > 2000 ? '(Sampled)' : ''}
         </h4>
         <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" dataKey="x" name="PC1" stroke="#94a3b8" tick={{fontSize: 12}} />
            <YAxis type="number" dataKey="y" name="PC2" stroke="#94a3b8" tick={{fontSize: 12}} />
            <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ payload }) => {
                    if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                            <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-xs">
                                <p className="font-bold mb-1">ID: {data.id}</p>
                                <p>PC1: {data.x.toFixed(2)}</p>
                                <p>PC2: {data.y.toFixed(2)}</p>
                            </div>
                        );
                    }
                    return null;
                }}
            />
            <Scatter name="Items" data={pcaData} fill="#8884d8">
                {pcaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'][index % 4]} />
                ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
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

    // Calculate center
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
                    <Maximize2 size={16} /> T-SNE / PCA
                </button>
                <button 
                    onClick={() => setActiveTab('map')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <MapIcon size={16} /> Geospatial
                </button>
            </div>

            <button 
                onClick={generateInsight}
                disabled={loadingInsight}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
                <Lightbulb size={14} />
                {loadingInsight ? 'Analyzing...' : 'Explain this View'}
            </button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 p-4 relative overflow-hidden">
            {activeTab === 'distribution' && renderDistribution()}
            {activeTab === 'pca' && renderPCA()}
            {activeTab === 'map' && renderMap()}
        </div>

        {/* AI Insight Overlay */}
        {insight && (
            <div className="bg-slate-800/90 border-l-4 border-emerald-500 p-4 rounded-r shadow-lg animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-full shrink-0">
                        <Lightbulb size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h5 className="font-semibold text-emerald-200 text-sm mb-1">AI Insight</h5>
                        <p className="text-slate-300 text-sm leading-relaxed">{insight}</p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Visualizer;