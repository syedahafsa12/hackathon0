import React, { useState, useEffect, useCallback } from 'react';
import { getPriorityPlan, resortPriorities, formatTimestamp } from '@/services/agentService';
import { PriorityPlan, PriorityItem } from '@/types/agentTypes';

interface PriorityPanelProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const PriorityPanel: React.FC<PriorityPanelProps> = ({
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [plan, setPlan] = useState<PriorityPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPriorityPlan();
      setPlan(data);
      setError(null);
    } catch (err: any) {
      console.error('[PriorityPanel] Error:', err);
      // Don't show error if we already have data
      if (!plan) setError('Failed to load priority plan');
    } finally {
      setLoading(false);
    }
  }, [plan]);

  const handleResort = async () => {
    try {
      setGenerating(true);
      setError(null);
      await resortPriorities();
      await fetchPlan();
    } catch (err: any) {
      console.error('[PriorityPanel] Resort error:', err);
      setError('Failed to re-prioritize tasks');
    } finally {
      setGenerating(false);
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchPlan();

    if (autoRefresh) {
      const interval = setInterval(fetchPlan, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPlan, autoRefresh, refreshInterval]);

  const renderPrioritySection = (
    title: string,
    icon: string,
    items: PriorityItem[],
    bgColor: string,
    borderColor: string,
    emptyText: string
  ) => (
    <div className={`rounded-2xl p-4 ${bgColor} border-l-4 ${borderColor} shadow-sm transition-all hover:shadow-md`}>
      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span> {title}
        <span className="text-xs text-gray-400 font-normal ml-auto">({items.length} items)</span>
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-2">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li key={item.id || idx} className="flex items-start gap-3 group">
              <input
                type="checkbox"
                checked={checkedItems.has(item.id || `item-${idx}`)}
                onChange={() => toggleChecked(item.id || `item-${idx}`)}
                className="mt-1 h-5 w-5 rounded border-pink-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${checkedItems.has(item.id || `item-${idx}`) ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                  {item.text}
                </p>
                {/* Markdown checkbox items are just text here, but we can style them */}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (loading && !plan) {
    return (
      <div className="kawaii-card p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="kawaii-card p-6 relative overflow-hidden">
      {/* Background Micro-animation element */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-100 rounded-full blur-3xl opacity-50 pointer-events-none animate-pulse"></div>

      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">
            Today's Priorities
          </h3>
          {plan && (
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Last updated: {formatTimestamp(plan.lastUpdated)}
            </p>
          )}
        </div>
        <button
          onClick={handleResort}
          disabled={generating || loading}
          className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm px-5 py-2.5 font-bold shadow-lg shadow-pink-200 hover:shadow-pink-300 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sorting...
            </span>
          ) : (
            '↻ Re-prioritize'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {plan ? (
        <div className="space-y-5 relative z-10">
          {renderPrioritySection(
            'Do Now',
            '🔥',
            plan.sections.doNow,
            'bg-red-50/50',
            'border-red-400',
            'Nothing urgent - great!'
          )}

          {renderPrioritySection(
            'Do Next',
            '⚡',
            plan.sections.doNext,
            'bg-yellow-50/50',
            'border-yellow-400',
            'Queue is clear'
          )}

          {renderPrioritySection(
            'Can Wait',
            '💤',
            plan.sections.canWait,
            'bg-green-50/50',
            'border-green-400',
            'All caught up!'
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4 animate-bounce">📋</div>
          <p className="text-gray-600 font-bold">No priority plan found</p>
          <p className="text-sm text-gray-400 mt-1">Talk to Mini Hafsa to generate a plan!</p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-pink-100">
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          <span>Priority Sorter AI v1.0</span>
          <span>Next refresh in 30s</span>
        </div>
      </div>
    </div>
  );
};

export default PriorityPanel;

