import React from 'react';
import { ViewState } from '../types';
import { Compass, Search, FileText, CheckCircle2, Info } from 'lucide-react';

interface SensemakingAssistantProps {
  view: ViewState;
  datasetName?: string;
  overrideHint?: string; // Allow external components to inject hints
}

const SensemakingAssistant: React.FC<SensemakingAssistantProps> = ({ view, datasetName, overrideHint }) => {
  if (!datasetName) return null;

  const getHints = () => {
    switch(view) {
        case ViewState.CLEAN:
            return {
                stage: 'Foraging & Schematizing',
                hint: 'Look for missing data patterns. Use "Refine Scope" to crop noise. Rename columns to human-readable labels to build a schema.',
                icon: Search
            };
        case ViewState.ANALYZE:
            return {
                stage: 'Schematizing & Analysis',
                hint: 'Check the "Fidelity" gauge. Are you altering too much data? Hover over correlation cells to understand relationships.',
                icon: FileText
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

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
        <div className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl shadow-2xl shadow-indigo-900/20 max-w-xs backdrop-blur-md transition-all duration-300">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
                <div className={`p-1.5 rounded-full ${overrideHint ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {overrideHint ? <Info size={16} /> : <Icon size={16} />}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wide">Sensemaking Assistant</h4>
                    <p className="text-[10px] text-slate-500">{overrideHint ? 'Interactive Insight' : stage}</p>
                </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[3rem]">
                {overrideHint || hint}
            </p>
        </div>
    </div>
  );
};

export default SensemakingAssistant;