import React, { useState, useEffect, useCallback } from 'react';
import { getLatestBriefing, formatTimestamp } from '@/services/agentService';
import { Briefing } from '@/types/agentTypes';

interface CEOBriefingBannerProps {
  onDismiss?: () => void;
}

const CEOBriefingBanner: React.FC<CEOBriefingBannerProps> = ({ onDismiss }) => {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const checkBriefing = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLatestBriefing();

      if (data) {
        setBriefing(data);
        // Check localStorage
        const lastDismissedId = localStorage.getItem('lastDismissedBriefingId');
        if (lastDismissedId === data.id) {
          setDismissed(true);
        }
      }
    } catch (err) {
      console.error('[CEOBriefingBanner] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkBriefing();
    // Check every 5 minutes
    const interval = setInterval(checkBriefing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkBriefing]);

  const handleDismiss = () => {
    if (briefing) {
      localStorage.setItem('lastDismissedBriefingId', briefing.id);
    }
    setDismissed(true);
    onDismiss?.();
  };

  if (loading || dismissed || !briefing) return null;

  return (
    <>
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-3xl mb-6 shadow-xl shadow-purple-100 flex items-center justify-between animate-in slide-in-from-top duration-500 relative overflow-hidden group">
        {/* Animated accent */}
        <div className="absolute top-0 -left-10 w-40 h-full bg-white/10 skew-x-[30deg] group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-md">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <p className="font-black text-sm tracking-tight">Weekly CEO Briefing Available</p>
            <p className="text-[10px] text-pink-100 font-bold uppercase tracking-widest">Analytics from {formatTimestamp(briefing.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-purple-600 hover:bg-pink-50 px-5 py-2 rounded-full text-xs font-black shadow-lg shadow-purple-900/20 transition-all active:scale-95"
          >
            Click to View
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
            title="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modal View */}
      {showModal && (
        <div className="fixed inset-0 bg-purple-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border-4 border-white animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-8 relative">
              <div className="absolute top-0 right-0 p-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-2xl backdrop-blur-md transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-200 mb-2">Executive Analysis</p>
              <h2 className="text-3xl font-black">{briefing.title}</h2>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto max-h-[50vh] prose prose-pink max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 font-medium leading-relaxed">
                {briefing.content}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">Generated by CEOBrief Agent</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 font-black text-sm shadow-xl shadow-pink-200"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CEOBriefingBanner;

