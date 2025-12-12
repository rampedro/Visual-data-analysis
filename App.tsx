import React, { useState } from 'react';
import { 
  Database, 
  BarChart2, 
  Settings2, 
  PieChart, 
  Github, 
  Layers,
  Wand2
} from 'lucide-react';
import { Dataset, ViewState } from './types';
import DataIngest from './components/DataIngest';
import DataGrid from './components/DataGrid';
import Analytics from './components/Analytics';
import Visualizer from './components/Visualizer';
import SensemakingAssistant from './components/SensemakingAssistant';

const App: React.FC = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.UPLOAD);
  const [assistantOverride, setAssistantOverride] = useState<string>('');

  const handleDataLoaded = (data: Dataset) => {
    setDataset(data);
    setView(ViewState.CLEAN);
  };
  
  const updateDataset = (d: Dataset) => {
      setDataset(d);
  };

  const NavItem = ({ id, icon: Icon, label }: { id: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setView(id)}
      disabled={!dataset}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all
        ${view === id 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {id === ViewState.VISUALIZE && <span className="ml-auto text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-indigo-400">New</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-500 mb-1">
            <Layers className="w-6 h-6" />
            <span className="font-bold text-lg text-white tracking-tight">DataRefine AI</span>
          </div>
          <p className="text-xs text-slate-500">Intelligent Data Platform</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem id={ViewState.UPLOAD} icon={Database} label="Load Data" />
          <NavItem id={ViewState.CLEAN} icon={Settings2} label="Prepare & View" />
          <NavItem id={ViewState.ANALYZE} icon={BarChart2} label="Analytics" />
          <NavItem id={ViewState.VISUALIZE} icon={PieChart} label="Visualize" />
          
          {dataset && (
            <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Dataset</h4>
              <p className="text-sm text-slate-200 truncate font-medium">{dataset.name}</p>
              <p className="text-xs text-slate-500 mt-1">{dataset.rows.length.toLocaleString()} rows</p>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <a href="#" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
            <Github size={16} />
            <span>Open Source v1.0</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-8 flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-100">
            {view === ViewState.UPLOAD && "Upload Dataset"}
            {view === ViewState.CLEAN && "Data Inspection"}
            {view === ViewState.ANALYZE && "Deep Analytics"}
            {view === ViewState.VISUALIZE && "Exploratory Visualization"}
          </h2>
          
          {dataset && (
             <div className="flex items-center gap-3">
                 <button className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-colors shadow-lg shadow-indigo-500/20">
                     <Wand2 size={12} />
                     AI Assistant Active
                 </button>
             </div>
          )}
        </header>

        <div className="flex-1 p-6 overflow-hidden relative">
          {view === ViewState.UPLOAD && (
            <DataIngest onDataLoaded={handleDataLoaded} />
          )}

          {view === ViewState.CLEAN && dataset && (
            <DataGrid dataset={dataset} onUpdateDataset={updateDataset} />
          )}

          {view === ViewState.ANALYZE && dataset && (
            <Analytics 
                dataset={dataset} 
                onUpdateDataset={updateDataset} 
                setAssistantOverride={setAssistantOverride}
            />
          )}

          {view === ViewState.VISUALIZE && dataset && (
            <Visualizer dataset={dataset} />
          )}
        </div>
        
        {/* Sensemaking Loop Persistent Assistant */}
        <SensemakingAssistant 
            view={view} 
            datasetName={dataset?.name} 
            overrideHint={assistantOverride}
        />
      </main>
    </div>
  );
};

export default App;