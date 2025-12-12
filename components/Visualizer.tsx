import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, ZAxis, Legend, Treemap, Brush
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import { Dataset, VizSuggestion, DimReductionAlgo } from '../types';
import { calculatePCA, PCAResult } from '../utils/pca';
import { computeTextEmbeddings } from '../utils/dataProcessing';
import { getExplainableInsight, getVisualizationSuggestions } from '../services/geminiService';
import { 
    Lightbulb, Maximize2, Map as MapIcon, BarChart2, Settings, 
    RefreshCcw, PanelRightClose, Box, Grid, AlertCircle, Network, Sliders,
    TrendingUp, Sparkles, X, Check, ArrowRight
} from 'lucide-react';
// @ts-ignore
import * as d3 from 'd3';

interface VisualizerProps {
  dataset: Dataset;
  setAssistantOverride: (msg: string) => void;
}

// --- D3 Component: Parallel Coordinates ---
const ParallelCoordinates: React.FC<{ data: any[], dimensions: string[], colorCol?: string }> = ({ data, dimensions, colorCol }) => {
    const d3Container = useRef(null);

    useEffect(() => {
        if (!data || !dimensions || dimensions.length < 2 || !d3Container.current) return;
        const width = 800;
        const height = 500;
        const margin = {top: 30, right: 10, bottom: 10, left: 0};
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(d3Container.current);
        svg.selectAll("*").remove();

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // 1. Build Scales for each dimension
        const y: Record<string, any> = {};
        dimensions.forEach(dim => {
            const domain = d3.extent(data, (d:any) => Number(d[dim]) || 0) as [number, number];
            y[dim] = d3.scaleLinear().domain(domain).range([innerHeight, 0]);
        });

        const x = d3.scalePoint().range([0, innerWidth]).padding(1).domain(dimensions);

        // 2. Color Scale
        const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, data.length]);
        // If colorCol is present and categorical, we could use ordinal, but keeping simple for now
        
        // 3. Draw Lines
        const line = d3.line()
            .defined((d: any) => !isNaN(d[1]))
            .x((d: any) => x(d[0]))
            .y((d: any) => y[d[0]](d[1]));

        g.selectAll("myPath")
            .data(data)
            .enter().append("path")
            .attr("d", (d: any) => line(dimensions.map(p => [p, d[p]])))
            .style("fill", "none")
            .style("stroke", (d: any, i: number) => colorCol ? "#6366f1" : colorScale(i)) // distinct color if grouped
            .style("opacity", 0.5)
            .style("stroke-width", 1.5);

        // 4. Draw Axes
        g.selectAll("myAxis")
            .data(dimensions).enter()
            .append("g")
            .attr("transform", (d: any) => `translate(${x(d)})`)
            .each(function(d: any) { d3.select(this).call(d3.axisLeft(y[d])); })
            .append("text")
            .style("text-anchor", "middle")
            .attr("y", -9)
            .text((d: any) => d)
            .style("fill", "#94a3b8")
            .style("font-size", "10px");

    }, [data, dimensions, colorCol]);

    return <svg className="w-full h-full" ref={d3Container} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet"></svg>;
}

// --- D3 Component: Bertin Matrix ---
const BertinMatrix: React.FC<{ data: any[], xCol: string, yCol: string, valCol: string }> = ({ data, xCol, yCol, valCol }) => {
    const d3Container = useRef(null);

    useEffect(() => {
        if (!data || !d3Container.current) return;
        const width = 600, height = 400;
        const svg = d3.select(d3Container.current);
        svg.selectAll("*").remove();

        const margin = {top: 40, right: 20, bottom: 40, left: 60};
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const matrixData: {x: string, y: string, v: number}[] = data.map(d => ({
            x: String(d[xCol]), y: String(d[yCol]), v: Number(d[valCol]) || 0
        }));

        const xDomain = Array.from(new Set(matrixData.map(d => d.x))).sort();
        const yDomain = Array.from(new Set(matrixData.map(d => d.y))).sort();

        const x = d3.scaleBand().domain(xDomain).range([0, innerWidth]).padding(0.05);
        const y = d3.scaleBand().domain(yDomain).range([0, innerHeight]).padding(0.05);
        const color = d3.scaleSequential(d3.interpolateViridis)
            .domain([d3.min(matrixData, (d:any) => d.v), d3.max(matrixData, (d:any) => d.v)]);

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        g.selectAll("rect")
            .data(matrixData)
            .enter().append("rect")
            .attr("x", (d:any) => x(d.x) || 0)
            .attr("y", (d:any) => y(d.y) || 0)
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .style("fill", (d:any) => color(d.v))
            .append("title").text((d:any) => `${d.x}, ${d.y}: ${d.v}`);

        g.append("g").call(d3.axisLeft(y));
        g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));

    }, [data, xCol, yCol, valCol]);

    return <svg className="w-full h-full" ref={d3Container} viewBox="0 0 600 400"></svg>;
}

// --- D3 Layer: Canada Quadtree ---
const CanadaDensityLayer: React.FC<{ points: {lat: number, lng: number}[] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
        if (!points || points.length === 0) return;
        map.setView([56.1304, -106.3468], 3); 
    }, [points, map]);
    return (
        <>
        {points.slice(0, 1000).map((p, i) => (
            <CircleMarker key={i} center={[p.lat, p.lng]} radius={2} pathOptions={{ color: '#ef4444', fillOpacity: 0.5, weight: 0 }} />
        ))}
        </>
    )
}

const Visualizer: React.FC<VisualizerProps> = ({ dataset, setAssistantOverride }) => {
  const [activeTab, setActiveTab] = useState<'distribution' | 'pca' | 'map' | 'treemap' | 'matrix' | 'parallel'>('distribution');
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [configOpen, setConfigOpen] = useState(false); 

  // --- Configuration State ---
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [zAxis, setZAxis] = useState<string>(''); 
  const [colorVar, setColorVar] = useState<string>(''); 
  const [dimReductionAlgo, setDimReductionAlgo] = useState<DimReductionAlgo>('PCA');
  const [textEmbeddingCol, setTextEmbeddingCol] = useState<string>('');
  const [pointSize, setPointSize] = useState<number>(100);
  const [opacity, setOpacity] = useState<number>(0.7);
  const [showGrid, setShowGrid] = useState(true);
  const [xAxisAngle, setXAxisAngle] = useState<number>(-45); // Axis Orientation

  // Parallel Coords State
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);

  // Force Layout State for t-SNE/UMAP simulation
  const [simulatedData, setSimulatedData] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // AI Suggestions
  const [suggestions, setSuggestions] = useState<VizSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const numericCols = useMemo(() => dataset.columns.filter(c => c.type === 'number' && c.isActive), [dataset.columns]);
  const allCols = useMemo(() => dataset.columns.filter(c => c.isActive), [dataset.columns]);
  const stringCols = useMemo(() => dataset.columns.filter(c => c.type === 'string' && c.isActive), [dataset.columns]);

  // Defaults
  useEffect(() => {
      if (activeTab === 'pca' && numericCols.length > 0 && (!xAxis || !xAxis.startsWith('PCA'))) {
          setXAxis('PCA1');
          setYAxis('PCA2');
      }
      if (activeTab === 'matrix' && stringCols.length > 0 && !xAxis) {
          setXAxis(stringCols[0].name);
          setYAxis(stringCols[1]?.name || stringCols[0].name);
      }
      if (activeTab === 'distribution' && !xAxis && allCols.length > 0) {
          setXAxis(allCols[0].name);
      }
      if (activeTab === 'parallel' && selectedDimensions.length === 0 && numericCols.length > 0) {
          setSelectedDimensions(numericCols.slice(0, 5).map(c => c.name));
      }
  }, [numericCols, stringCols, activeTab, xAxis, allCols, selectedDimensions]);

  // AI Actions
  const handleFetchSuggestions = async () => {
      setLoadingSuggestions(true);
      setShowSuggestions(true);
      const res = await getVisualizationSuggestions(dataset.columns, dataset.rows.slice(0, 5));
      setSuggestions(res);
      setLoadingSuggestions(false);
  };

  const applySuggestion = (s: VizSuggestion) => {
      if (s.type === 'bar') { setActiveTab('distribution'); setXAxis(s.x); }
      if (s.type === 'scatter') { setActiveTab('pca'); setXAxis(s.x); setYAxis(s.y); if(s.z) setColorVar(s.z); }
      if (s.type === 'map') { setActiveTab('map'); }
      setShowSuggestions(false);
      setAssistantOverride(`Applied suggestion: ${s.title}`);
  };

  // -- PCA / Projection Logic --
  const drResult: PCAResult = useMemo(() => {
    if (activeTab !== 'pca') return { data: [], loadings: { pc1: [], pc2: [] } };

    if (textEmbeddingCol) {
        const vectors = computeTextEmbeddings(dataset.rows, textEmbeddingCol);
        const vocabSize = vectors[0]?.length || 0;
        const virtualCols = Array.from({length: vocabSize}, (_, i) => `dim_${i}`);
        const virtualRows = vectors.map((vec, i) => {
            const row: any = { id: dataset.rows[i].id };
            vec.forEach((v, idx) => row[`dim_${idx}`] = v);
            return row;
        });
        return calculatePCA(virtualRows, virtualCols);
    }
    
    if (numericCols.length >= 2) {
        const MAX_POINTS = 1000;
        let rowsToProcess = dataset.rows;
        if (rowsToProcess.length > MAX_POINTS) {
            const step = Math.ceil(rowsToProcess.length / MAX_POINTS);
            rowsToProcess = rowsToProcess.filter((_, i) => i % step === 0);
        }
        return calculatePCA(rowsToProcess, numericCols.map(c => c.name));
    }
    return { data: [], loadings: { pc1: [], pc2: [] } };
  }, [dataset, activeTab, numericCols, textEmbeddingCol]);

  // -- Force Simulation Effect --
  useEffect(() => {
      if (activeTab !== 'pca' || dimReductionAlgo === 'PCA' || drResult.data.length === 0) {
          setSimulatedData([]);
          setIsSimulating(false);
          return;
      }
      setIsSimulating(true);
      const nodes = drResult.data.map(d => ({ ...d, x: d.x * 50, y: d.y * 50 })); 
      const links: any[] = [];
      nodes.forEach((node, i) => {
          let closest = [];
          for(let j=0; j<nodes.length; j++) {
              if (i === j) continue;
              const dx = nodes[j].x - node.x;
              const dy = nodes[j].y - node.y;
              const dist = dx*dx + dy*dy;
              closest.push({ idx: j, dist });
          }
          closest.sort((a,b) => a.dist - b.dist);
          closest.slice(0, 3).forEach(n => links.push({ source: i, target: n.idx }));
      });
      const simulation = d3.forceSimulation(nodes)
          .force("charge", d3.forceManyBody().strength(-30)) 
          .force("link", d3.forceLink(links).distance(10).strength(0.5)) 
          .force("center", d3.forceCenter(0, 0))
          .stop();
      for (let i = 0; i < 150; ++i) simulation.tick();
      setSimulatedData(nodes);
      setIsSimulating(false);
  }, [drResult, activeTab, dimReductionAlgo]);

  const plotData = useMemo(() => {
    if (activeTab !== 'pca') return [];
    const sourceData = (dimReductionAlgo !== 'PCA' && simulatedData.length > 0) ? simulatedData : drResult.data;
    if (!sourceData || sourceData.length === 0) return [];
    return sourceData.map(r => ({
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        z: zAxis ? (Number(r[zAxis]) || 1) : 1,
        color: colorVar ? String(r[colorVar]) : 'default',
        id: r.id,
        ...dataset.rows.find(orig => orig.id === r.id)
    }));
  }, [drResult, simulatedData, dimReductionAlgo, activeTab, xAxis, yAxis, zAxis, colorVar, dataset.rows]);

  const uniqueColors = useMemo(() => [...new Set(plotData.map(d => d.color))].slice(0, 20), [plotData]);
  const getColor = (val: string, index: number) => {
      if (val === 'default') return '#6366f1';
      const palette = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6'];
      return palette[index % palette.length];
  };

  // -- Treemap Logic --
  const treemapData = useMemo(() => {
      if (activeTab !== 'treemap' || !dataset.hierarchy) return [];
      const { levels } = dataset.hierarchy;
      if (!levels || levels.length === 0) return [];
      const buildTree = (data: any[], depth: number): any[] => {
          if (depth >= levels.length) return [];
          const key = levels[depth];
          const groups: Record<string, any[]> = {};
          data.forEach(row => {
              const val = String(row[key] || 'Unknown');
              if(!groups[val]) groups[val] = [];
              groups[val].push(row);
          });
          return Object.keys(groups).map(gVal => {
              const children = buildTree(groups[gVal], depth + 1);
              const size = groups[gVal].length;
              return { name: gVal, children: children.length > 0 ? children : undefined, size: size };
          });
      };
      return buildTree(dataset.rows, 0);
  }, [dataset, activeTab]);

  // -- Map Logic --
  const mapData = useMemo(() => {
    const points: {lat: number, lng: number, id: string}[] = [];
    dataset.rows.forEach(r => {
        if (r['_lat'] && r['_lng']) {
            points.push({ lat: Number(r['_lat']), lng: Number(r['_lng']), id: String(r.id) });
        } else {
            const latKey = Object.keys(r).find(k => /lat/i.test(k));
            const lngKey = Object.keys(r).find(k => /lon|lng/i.test(k));
            if (latKey && lngKey) {
                points.push({ lat: Number(r[latKey]), lng: Number(r[lngKey]), id: String(r.id) });
            }
        }
    });
    return points;
  }, [dataset]);

  const generateInsight = async () => {
    setLoadingInsight(true);
    let context = activeTab === 'pca' ? `Scatter: ${xAxis} vs ${yAxis}.` : activeTab === 'map' ? "Geospatial." : "Distribution";
    const text = await getExplainableInsight(context, `Sample size: ${dataset.rows.length}`);
    setInsight(text);
    setLoadingInsight(false);
  };

  // --- Renderers ---
  const renderDistribution = () => {
    const colName = xAxis || allCols[0]?.name;
    if (!colName) return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <AlertCircle size={48} className="opacity-20"/>
            <p>No variables selected.</p>
            <button onClick={() => setConfigOpen(true)} className="text-indigo-400 hover:text-white underline">Open Configuration</button>
        </div>
    );
    const col = dataset.columns.find(c => c.name === colName);
    if (!col) return null;

    let chartData: { name: string, count: number }[] = [];
    if (col.type === 'number') {
        const values = dataset.rows.map(r => Number(r[colName])).filter(n => !isNaN(n));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 20;
        const step = (max === min) ? 1 : (max - min) / binCount;
        const bins = Array.from({length: binCount + 1}, (_, i) => ({ name: (min + i * step).toFixed(1), count: 0 }));
        values.forEach(v => {
            const binIndex = Math.floor((v - min) / step);
            const idx = Math.min(binIndex, binCount); 
            if(bins[idx]) bins[idx].count++;
        });
        chartData = bins;
    } else {
        const counts: Record<string, number> = {};
        dataset.rows.forEach(r => {
            const val = String(r[colName] ?? 'NULL');
            counts[val] = (counts[val] || 0) + 1;
        });
        chartData = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 30);
    }

    return (
        <div className="h-full flex flex-col animate-in fade-in">
             <div className="flex justify-between items-center mb-4 px-2 shrink-0">
                <h3 className="text-sm font-bold text-slate-300">Distribution: <span className="text-white">{colName}</span></h3>
            </div>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                        <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            tick={{fontSize: 10}} 
                            angle={xAxisAngle} 
                            textAnchor="end" 
                            interval={0} 
                            height={60} 
                        />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor:'#334155', color: '#f1f5f9'}} cursor={{fill: '#334155', opacity: 0.2}} />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Count" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
  };

  const renderScatter = () => {
    if (plotData.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
             {isSimulating ? <RefreshCcw className="animate-spin text-indigo-500" size={32}/> : <ScatterChart size={48} className="opacity-20" />}
             <p>{isSimulating ? "Running Force Simulation..." : "No data available."}</p>
             {!isSimulating && <button onClick={() => setConfigOpen(true)} className="text-indigo-400 hover:text-white underline">Configure Variables</button>}
        </div>
    );

    return (
        <div className="h-full w-full relative animate-in fade-in">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                    {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />}
                    {dimReductionAlgo === 'PCA' && <XAxis type="number" dataKey="x" stroke="#94a3b8" tick={{fontSize: 10}} name={xAxis} />}
                    {dimReductionAlgo === 'PCA' && <YAxis type="number" dataKey="y" stroke="#94a3b8" tick={{fontSize: 10}} name={yAxis} />}
                    {dimReductionAlgo !== 'PCA' && <XAxis type="number" dataKey="x" hide />}
                    {dimReductionAlgo !== 'PCA' && <YAxis type="number" dataKey="y" hide />}
                    {zAxis && <ZAxis type="number" dataKey="z" range={[pointSize/2, pointSize * 4]} name={zAxis} />}
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#0f172a', borderColor:'#334155'}} />
                    {colorVar ? (
                        uniqueColors.map((colorVal, idx) => (
                             <Scatter key={colorVal} name={colorVal} data={plotData.filter(d => d.color === colorVal)} fill={getColor(colorVal, idx)} opacity={opacity} />
                        ))
                    ) : <Scatter name="Data" data={plotData} fill="#6366f1" opacity={opacity} />}
                    {colorVar && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                    <Brush dataKey="x" height={20} stroke="#4f46e5" fill="#1e293b" />
                </ScatterChart>
            </ResponsiveContainer>
            
            {/* PCA Loadings Contribution Panel */}
            {dimReductionAlgo === 'PCA' && drResult.loadings.pc1.length > 0 && (
                <div className="absolute top-4 right-4 w-52 bg-slate-900/90 backdrop-blur p-3 rounded border border-slate-700 shadow-xl overflow-hidden animate-in slide-in-from-right-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">PCA Contributions</h4>
                    <div className="space-y-3">
                        <div>
                            <span className="text-[10px] font-semibold text-indigo-400 block border-b border-indigo-500/20 mb-1">PC1 (X-Axis)</span>
                            <div className="space-y-1">
                                {drResult.loadings.pc1.slice(0, 3).map((l, i) => (
                                    <div key={i} className="flex justify-between text-[9px] text-slate-300">
                                        <span className="truncate w-32">{l.name}</span>
                                        <span>{l.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-semibold text-pink-400 block border-b border-pink-500/20 mb-1">PC2 (Y-Axis)</span>
                            <div className="space-y-1">
                                {drResult.loadings.pc2.slice(0, 3).map((l, i) => (
                                    <div key={i} className="flex justify-between text-[9px] text-slate-300">
                                        <span className="truncate w-32">{l.name}</span>
                                        <span>{l.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderParallel = () => {
    if (selectedDimensions.length < 2) return (
         <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
             <TrendingUp size={48} className="opacity-20" />
             <p>Select at least 2 numeric columns.</p>
             <button onClick={() => setConfigOpen(true)} className="text-indigo-400 hover:text-white underline">Configure Columns</button>
         </div>
    );

    return (
        <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
             <ParallelCoordinates 
                data={dataset.rows.slice(0, 50)} 
                dimensions={selectedDimensions} 
                colorCol={colorVar}
             />
        </div>
    );
  }

  const renderMatrix = () => {
      if (stringCols.length < 2) return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
               <Grid size={48} className="opacity-20" />
               <p>Matrix requires at least 2 Text columns.</p>
          </div>
      );
      return (
        <div className="h-full flex flex-col items-center justify-center">
             <BertinMatrix 
                data={dataset.rows.slice(0, 50)} 
                xCol={xAxis || stringCols[0].name} 
                yCol={yAxis || stringCols[1].name} 
                valCol={zAxis || numericCols[0]?.name} 
             />
        </div>
      );
  }

  const renderTreemap = () => {
    if (treemapData.length === 0) return (
         <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
             <Network size={48} className="opacity-20" />
             <p>No Hierarchy Defined.</p>
             <p className="text-xs">Go to Workspace &gt; Hierarchy to define levels.</p>
         </div>
    );
    return (
     <div className="h-full w-full animate-in fade-in">
        <ResponsiveContainer width="100%" height="100%">
            <Treemap data={treemapData} dataKey="size" ratio={4 / 3} stroke="#fff" fill="#8884d8">
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} />
            </Treemap>
        </ResponsiveContainer>
     </div>
    );
  };

  const renderMap = () => (
      <div className="h-full w-full rounded-lg overflow-hidden border border-slate-800 relative animate-in fade-in">
          {mapData.length > 0 ? (
            <MapContainer center={[56.1304, -106.3468]} zoom={4} style={{ height: '100%', width: '100%', background: '#0f172a' }}>
                <TileLayer attribution='&copy; OSM' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <CanadaDensityLayer points={mapData} />
            </MapContainer>
          ) : <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-2"><MapIcon size={32} className="opacity-20"/><p>No geo-coordinates found.</p></div>}
          <div className="absolute top-4 right-4 bg-slate-900/80 p-2 rounded backdrop-blur text-xs">
              <span className="text-indigo-400 font-bold">Canada Projection</span>
          </div>
      </div>
  );

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
        {/* Main Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 rounded-xl overflow-hidden relative">
             {/* Floating Tab Bar - Uncluttered */}
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-full border border-slate-700 flex gap-1 shadow-2xl">
                <button onClick={() => setActiveTab('distribution')} className={`p-2 rounded-full transition-all ${activeTab === 'distribution' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Distribution"><BarChart2 size={18} /></button>
                <button onClick={() => setActiveTab('pca')} className={`p-2 rounded-full transition-all ${activeTab === 'pca' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Scatter/PCA"><Maximize2 size={18} /></button>
                <button onClick={() => setActiveTab('map')} className={`p-2 rounded-full transition-all ${activeTab === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Geo Map"><MapIcon size={18} /></button>
                <button onClick={() => setActiveTab('treemap')} className={`p-2 rounded-full transition-all ${activeTab === 'treemap' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Hierarchy Treemap"><Box size={18} /></button>
                <button onClick={() => setActiveTab('matrix')} className={`p-2 rounded-full transition-all ${activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Bertin Matrix"><Grid size={18} /></button>
                <button onClick={() => setActiveTab('parallel')} className={`p-2 rounded-full transition-all ${activeTab === 'parallel' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`} title="Parallel Coordinates"><TrendingUp size={18} /></button>
                <div className="w-px h-6 bg-slate-700 mx-2 self-center"></div>
                <button onClick={handleFetchSuggestions} className="p-2 rounded-full text-indigo-400 hover:text-white hover:bg-indigo-500/20" title="Get AI Suggestions"><Sparkles size={18} className={loadingSuggestions ? "animate-spin" : ""} /></button>
                <button onClick={() => setConfigOpen(!configOpen)} className={`p-2 rounded-full transition-all ${configOpen ? 'text-white bg-slate-700' : 'text-slate-400 hover:text-white'}`} title="Settings"><Sliders size={18} /></button>
             </div>

             {/* Visualization Content */}
             <div className="flex-1 p-6 relative">
                {activeTab === 'distribution' && renderDistribution()}
                {activeTab === 'pca' && renderScatter()}
                {activeTab === 'map' && renderMap()}
                {activeTab === 'treemap' && renderTreemap()}
                {activeTab === 'matrix' && renderMatrix()}
                {activeTab === 'parallel' && renderParallel()}

                {/* AI Suggestions Overlay */}
                {showSuggestions && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-4 w-96 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2"><Sparkles size={14}/> Visualization Ideas</h4>
                            <button onClick={() => setShowSuggestions(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                        </div>
                        <div className="space-y-2">
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => applySuggestion(s)} className="w-full text-left bg-slate-800 hover:bg-slate-700 p-2 rounded border border-slate-700/50 group">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-xs text-slate-200">{s.title}</span>
                                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400"/>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{s.reason}</p>
                                </button>
                            ))}
                            {suggestions.length === 0 && !loadingSuggestions && <p className="text-xs text-slate-500 italic">No specific suggestions found.</p>}
                        </div>
                    </div>
                )}

                {/* AI Fab */}
                <div className="absolute bottom-6 left-6 z-20">
                     <button onClick={generateInsight} disabled={loadingInsight} className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center">
                        {loadingInsight ? <RefreshCcw size={20} className="animate-spin" /> : <Lightbulb size={20} />} 
                     </button>
                     {insight && (
                        <div className="absolute bottom-14 left-0 w-80 bg-slate-900/95 backdrop-blur border border-emerald-500/30 p-4 rounded-xl shadow-2xl text-xs text-slate-200 animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-emerald-400 uppercase tracking-wider">AI Insight</span>
                                <button onClick={() => setInsight('')} className="text-slate-500 hover:text-white"><PanelRightClose size={12}/></button>
                            </div>
                            {insight}
                        </div>
                     )}
                </div>
             </div>
        </div>

        {/* Configuration Drawer */}
        {configOpen && (
            <div className="w-72 bg-slate-900/90 backdrop-blur-md border-l border-slate-800 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300 absolute right-0 top-0 bottom-0 z-30 shadow-2xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between text-slate-200">
                    <span className="font-bold text-sm flex items-center gap-2"><Settings size={14}/> Config</span>
                    <button onClick={() => setConfigOpen(false)}><PanelRightClose size={16}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {activeTab === 'distribution' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Variable</label>
                                <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    <option value="">-- Select --</option>
                                    {allCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Label Rotation: {xAxisAngle}°</label>
                                <input type="range" min="-90" max="0" value={xAxisAngle} onChange={e => setXAxisAngle(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pca' && (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 p-2 rounded">
                                <label className="text-[10px] text-slate-400 uppercase block mb-2">Algorithm</label>
                                <div className="flex gap-1">
                                    {['PCA', 't-SNE', 'UMAP'].map(a => (
                                        <button key={a} onClick={() => setDimReductionAlgo(a as any)} className={`flex-1 text-[10px] py-1 rounded ${dimReductionAlgo === a ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400'}`}>{a}</button>
                                    ))}
                                </div>
                            </div>
                            {dimReductionAlgo === 'PCA' && (
                                <>
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">X Axis</label>
                                    <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                        <option value="PCA1">Auto (PCA 1)</option>
                                        {allCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block mb-1">Y Axis</label>
                                    <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                        <option value="PCA2">Auto (PCA 2)</option>
                                        {allCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                </>
                            )}
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Color Group</label>
                                <select value={colorVar} onChange={e => setColorVar(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    <option value="">Single Color</option>
                                    {allCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parallel' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Dimensions (Select Multiple)</label>
                                <div className="h-40 overflow-y-auto bg-slate-950 border border-slate-700 rounded p-2 space-y-1">
                                    {numericCols.map(c => (
                                        <label key={c.name} className="flex items-center gap-2 text-xs text-slate-300">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedDimensions.includes(c.name)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setSelectedDimensions([...selectedDimensions, c.name]);
                                                    else setSelectedDimensions(selectedDimensions.filter(d => d !== c.name));
                                                }}
                                                className="rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-0"
                                            />
                                            {c.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Color Group</label>
                                <select value={colorVar} onChange={e => setColorVar(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    <option value="">Default (Index)</option>
                                    {allCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'matrix' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Rows (X)</label>
                                <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    {stringCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Cols (Y)</label>
                                <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    {stringCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Value (Color)</label>
                                <select value={zAxis} onChange={e => setZAxis(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200">
                                    {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-4 border-t border-slate-800">
                        <label className="text-[10px] text-slate-400 block mb-2">Point Size: {pointSize}px</label>
                        <input type="range" min="10" max="300" value={pointSize} onChange={e => setPointSize(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Visualizer;