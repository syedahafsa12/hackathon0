import React, { useState, useEffect, useCallback } from 'react';
import { formatTimestamp } from '@/services/agentService';
import RalphLoopProgress from '@/components/ralph/RalphLoopProgress';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface Reminder {
  id: string;
  title: string;
  description?: string;
  remindAt: string;
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: string;
}

interface ReminderPanelProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ReminderPanel: React.FC<ReminderPanelProps> = ({
  autoRefresh = true,
  refreshInterval = 10000
}) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[ReminderPanel] Fetching reminders...');
      const response = await fetch(`${API_BASE_URL}/api/reminders`);
      const result = await response.json();

      if (result.success && result.data?.reminders) {
        console.log('[ReminderPanel] Found reminders:', result.data.reminders.length);
        setReminders(result.data.reminders);
        setError(null);
      } else {
        setReminders([]);
      }
    } catch (err: any) {
      console.error('[ReminderPanel] Error:', err);
      if (reminders.length === 0) setError('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, [reminders.length]);

  useEffect(() => {
    fetchReminders();
    if (autoRefresh) {
      const interval = setInterval(fetchReminders, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchReminders, autoRefresh, refreshInterval]);

  const handleComplete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (response.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'completed' } : r));
      }
    } catch (err) {
      setError('Failed to mark as done');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' })
      });
      if (response.ok) {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
      }
    } catch (err) {
      setError('Failed to dismiss');
    }
  };

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const activeReminders = reminders.filter(r => r.status === 'pending');
  const todayReminders = activeReminders.filter(r => new Date(r.remindAt) <= todayEnd);
  const upcomingReminders = activeReminders.filter(r => new Date(r.remindAt) > todayEnd);
  const completedReminders = reminders.filter(r => r.status === 'completed');

  const ReminderItem = ({ reminder }: { reminder: Reminder }) => {
    const remindAt = new Date(reminder.remindAt);
    const isOverdue = remindAt < now;
    const isSoon = !isOverdue && remindAt.getTime() - now.getTime() < 30 * 60 * 1000; // Within 30 min

    const theme = isOverdue
      ? { bg: 'bg-red-50/50', border: 'border-red-400' }
      : isSoon
        ? { bg: 'bg-yellow-50/50', border: 'border-yellow-400' }
        : { bg: 'bg-blue-50/50', border: 'border-blue-400' };

    return (
      <div className={`p-4 rounded-2xl border-l-4 ${theme.border} ${theme.bg} shadow-sm transition-all hover:shadow-md mb-3`}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-800 truncate">{reminder.title}</h4>
            {reminder.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{reminder.description}</p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <span className={`text-[10px] font-bold flex items-center gap-1 ${isOverdue ? 'text-red-500' : isSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                {isOverdue ? '⚠️ Overdue' : isSoon ? '🔔 Soon' : '⏰'} {formatTimestamp(reminder.remindAt)}
              </span>
              <span className="text-[10px] text-gray-400">
                {remindAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-3">
            <button
              onClick={() => handleDismiss(reminder.id)}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors text-lg"
              title="Dismiss"
            >
              ❌
            </button>
            <button
              onClick={() => handleComplete(reminder.id)}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors text-lg"
              title="Complete"
            >
              ✅
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="kawaii-card p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      <div className="flex justify-between items-center mb-6 relative z-10">
        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">
          Task Pulse
        </h3>
        <button
          onClick={fetchReminders}
          disabled={loading}
          className="w-10 h-10 flex items-center justify-center bg-pink-50 text-pink-500 rounded-2xl hover:bg-pink-100 transition-all font-bold"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          ) : '↻'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-xs flex items-center gap-2">
          <span>🚨</span> {error}
        </div>
      )}

      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1 customize-scrollbar">
        {todayReminders.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-ping"></span>
              Live Today
            </h4>
            {todayReminders.map(t => <ReminderItem key={t.id} reminder={t} />)}
          </div>
        )}

        {upcomingReminders.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">
              Upcoming Queue
            </h4>
            {upcomingReminders.slice(0, 5).map(t => <ReminderItem key={t.id} reminder={t} />)}
          </div>
        )}

        {todayReminders.length === 0 && upcomingReminders.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 grayscale opacity-50">🎊</div>
            <p className="text-gray-600 font-black">All Caught Up!</p>
            <p className="text-xs text-gray-400 mt-1">Your schedule is crystal clear.</p>
          </div>
        )}

        {completedReminders.length > 0 && (
          <div className="pt-4 border-t border-pink-50">
            <details className="group">
              <summary className="text-[10px] font-black text-gray-300 uppercase tracking-widest cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform">▸</span>
                Archived ({completedReminders.length})
              </summary>
              <div className="mt-4 space-y-2 opacity-60 grayscale scale-95 origin-top transition-all">
                {completedReminders.slice(0, 5).map(t => (
                  <div key={t.id} className="text-sm text-gray-400 flex items-center gap-2 px-2">
                    <span className="text-xs">✓</span>
                    <span className="line-through">{t.title}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-pink-100 flex justify-center">
        <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
          Ralph Loop v2.0 • Real-time Monitoring
        </span>
      </div>
    </div>
  );
};

export default ReminderPanel;

