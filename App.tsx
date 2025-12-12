import React, { useState } from 'react';
import { 
  Database, 
  BarChart2, 
  Settings2, 
  PieChart, 
  Github, 
  Layers,
  Wand2,
  Copy,
  Layout,
  Table,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { Dataset, ViewState } from './types';
import DataIngest from './components/DataIngest';
import Workspace from './components/Workspace'; // New Unified View
import Analytics from './components/Analytics';
import Visualizer from './components/Visualizer';
import SensemakingAssistant from './components/SensemakingAssistant';

const App: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.UPLOAD);
  const [assistantOverride, setAssistantOverride] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeDataset = datasets.find(d => d.id === activeDatasetId) || null;

  const handleDataLoaded = (data: Dataset) => {
    setDatasets(prev => [...prev, data]);
    setActiveDatasetId(data.id);
    setView(ViewState.WORKSPACE);
  };
  
  const updateActiveDataset = (updated: Dataset) => {
      setDatasets(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const createSnapshot = () => {
      if (!activeDataset) return;
      const snapshot: Dataset = {
          ...activeDataset,
          id: crypto.randomUUID(),
          name: `${activeDataset.name} (View)`,
          parentId: activeDataset.id,
          created: Date.now()
      };
      setDatasets(prev => [...prev, snapshot]);
      setActiveDatasetId(snapshot.id);
  };

  const NavItem = ({ id, icon: Icon, label }: { id: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setView(id)}
      disabled={!activeDataset}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all
        ${view === id 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden`}>
        <div className="p-6 border-b border-slate-800 min-w-[16rem]">
          <div className="flex items-center gap-2 text-indigo-500 mb-1">
            <Layers className="w-6 h-6" />
            <span className="font-bold text-lg text-white tracking-tight">DataRefine AI</span>
          </div>
          <p className="text-xs text-slate-500">Intelligent Data Platform</p>
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-[16rem]">
            <nav className="p-4">
                <NavItem id={ViewState.UPLOAD} icon={Database} label="Load Data" />
                <NavItem id={ViewState.WORKSPACE} icon={Layout} label="Workspace" />
                {/* Analytics is now integrated differently or kept as advanced */}
                <NavItem id={ViewState.VISUALIZE} icon={PieChart} label="Visualize" />
            </nav>

            <div className="px-4 pb-4 mt-auto flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                     <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datasets</h4>
                     {activeDataset && (
                         <button onClick={createSnapshot} className="p-1 text-indigo-400 hover:text-white" title="Create Snapshot/View">
                             <Copy size={12} />
                         </button>
                     )}
                </div>
                <div className="space-y-1">
                    {datasets.map(d => (
                        <button 
                            key={d.id}
                            onClick={() => setActiveDatasetId(d.id)}
                            className={`w-full text-left p-2 rounded text-xs flex items-center gap-2 group transition-colors ${activeDatasetId === d.id ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:bg-slate-800/50'}`}
                        >
                            {d.parentId ? <Settings2 size={12} className="text-indigo-400"/> : <Table size={12} className="text-emerald-400"/>}
                            <span className="truncate flex-1">{d.name}</span>
                            {activeDatasetId === d.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white">
                  {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
              </button>
              <h2 className="text-xl font-semibold text-slate-100">
                {view === ViewState.UPLOAD && "Upload Dataset"}
                {view === ViewState.WORKSPACE && "Unified Workspace"}
                {view === ViewState.VISUALIZE && "Exploratory Visualization"}
              </h2>
          </div>
          
          {activeDataset && (
             <div className="flex items-center gap-3">
                 <button className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-colors shadow-lg shadow-indigo-500/20">
                     <Wand2 size={12} />
                     AI Active
                 </button>
             </div>
          )}
        </header>

        <div className="flex-1 p-6 overflow-hidden relative">
          {view === ViewState.UPLOAD && (
            <DataIngest onDataLoaded={handleDataLoaded} />
          )}

          {view === ViewState.WORKSPACE && activeDataset && (
            <div className="h-full flex flex-col">
                <div className="h-2/3 mb-4">
                     <Workspace 
                        dataset={activeDataset} 
                        availableDatasets={datasets}
                        onUpdateDataset={updateActiveDataset} 
                        setAssistantOverride={setAssistantOverride} 
                     />
                </div>
                <div className="h-1/3 border-t border-slate-800 pt-4">
                     <Analytics 
                        dataset={activeDataset} 
                        onUpdateDataset={updateActiveDataset} 
                        setAssistantOverride={setAssistantOverride}
                     />
                </div>
            </div>
          )}

          {view === ViewState.VISUALIZE && activeDataset && (
            <Visualizer dataset={activeDataset} setAssistantOverride={setAssistantOverride} />
          )}
        </div>
        
        <SensemakingAssistant 
            view={view} 
            datasetName={activeDataset?.name} 
            overrideHint={assistantOverride}
            onClearOverride={() => setAssistantOverride('')}
        />
      </main>
    </div>
  );
};

export default App;