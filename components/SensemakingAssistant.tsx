import React, { useState } from 'react';
import { ViewState } from '../types';
import { Compass, Search, FileText, CheckCircle2, Info, ChevronRight, ChevronLeft, X } from 'lucide-react';

interface SensemakingAssistantProps {
  view: ViewState;
  datasetName?: string;
  overrideHint?: string; // Allow external components to inject hints
  onClearOverride: () => void;
}

const SensemakingAssistant: React.FC<SensemakingAssistantProps> = ({ view, datasetName, overrideHint, onClearOverride }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!datasetName) return null;

  const getHints = () => {
    switch(view) {
        case ViewState.WORKSPACE:
            return {
                stage: 'Refining & Analysis',
                hint: 'Look for missing data patterns. Use "Refine Scope" to crop noise. Rename columns to human-readable labels to build a schema. Check "Fidelity" metrics below.',
                icon: Search
            };
        case ViewState.VISUALIZE:
            return {
                stage: 'Evidence Finding',
                hint: 'Use the Map or PCA to find clusters. These clusters are your evidence. Save interesting views.',
                icon: CheckCircle2
            };
        default:
            return { stage: 'Ready', hint: 'Upload data to begin.', icon: Compass };
    }
  };

  const { stage, hint, icon: Icon } = getHints();
  const displayHint = overrideHint || hint;

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 flex items-end ${isCollapsed ? 'translate-x-[calc(100%-3rem)]' : 'translate-x-0'}`}>
        
        {/* Toggle Button */}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="absolute -left-8 bottom-4 bg-slate-800 p-2 rounded-l-lg border border-r-0 border-indigo-500/30 text-indigo-400 hover:bg-slate-700 shadow-xl"
            title={isCollapsed ? "Show Assistant" : "Hide Assistant"}
        >
            {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>

        <div className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl shadow-2xl shadow-indigo-900/20 w-80 backdrop-blur-md relative">
            
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                <div className={`p-1.5 rounded-full ${overrideHint ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {overrideHint ? <Info size={16} /> : <Icon size={16} />}
                </div>
                <div className="flex-1">
                    <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wide">Sensemaking Assistant</h4>
                    <p className="text-[10px] text-slate-500 truncate">{overrideHint ? 'Interactive Insight' : stage}</p>
                </div>
                {overrideHint && (
                    <button onClick={onClearOverride} className="text-slate-500 hover:text-white" title="Clear Insight">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Content Body */}
            <div className="text-xs text-slate-300 leading-relaxed min-h-[3rem] max-h-[15rem] overflow-y-auto pr-1 custom-scrollbar">
                {/* Check if override hint contains specific keywords to format as code or list */}
                {displayHint.split('\n').map((line, i) => (
                    <p key={i} className={`mb-1 ${line.startsWith('-') ? 'pl-2 text-indigo-200' : ''} ${line.includes('//') ? 'font-mono text-[10px] text-slate-400' : ''}`}>
                        {line}
                    </p>
                ))}
            </div>
            
            {!isCollapsed && !overrideHint && (
                <div className="mt-3 pt-2 border-t border-slate-800/50 flex justify-between items-center text-[9px] text-slate-600">
                    <span>DataRefine AI Structure</span>
                    <span className="font-mono">{datasetName}</span>
                </div>
            )}
        </div>
    </div>
  );
};

export default SensemakingAssistant;