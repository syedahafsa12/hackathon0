import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface RalphIteration {
  number: number;
  timestamp: string;
  action: string;
  result: string;
  completionCheck: boolean;
}

interface RalphStatus {
  taskId: string;
  prompt: string;
  currentIteration: number;
  maxIterations: number;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: string;
  lastIterationAt: string;
  iterationCount: number;
}

interface RalphLoopProgressProps {
  taskId: string;
  onComplete?: (status: RalphStatus) => void;
  onStop?: () => void;
  compact?: boolean;
}

const RalphLoopProgress: React.FC<RalphLoopProgressProps> = ({
  taskId,
  onComplete,
  onStop,
  compact = false
}) => {
  const [status, setStatus] = useState<RalphStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      console.log('[RalphLoopProgress] Fetching status for:', taskId);

      const response = await fetch(`${API_BASE_URL}/api/ralph/status/${taskId}`);
      const result = await response.json();

      console.log('[RalphLoopProgress] Status:', result);

      if (result.success && result.status) {
        setStatus(result.status);
        setError(null);

        // Check if task is complete
        if (['completed', 'failed', 'stopped'].includes(result.status.status)) {
          onComplete?.(result.status);
        }
      } else {
        const errorMsg = result.error
          ? (typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error)))
          : 'Failed to fetch status';
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[RalphLoopProgress] Error:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [taskId, onComplete]);

  const stopTask = async () => {
    try {
      setStopping(true);
      console.log('[RalphLoopProgress] Stopping task:', taskId);

      const response = await fetch(`${API_BASE_URL}/api/ralph/stop/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      console.log('[RalphLoopProgress] Stop result:', result);

      if (result.success) {
        onStop?.();
        fetchStatus();
      } else {
        setError(result.error || 'Failed to stop task');
      }
    } catch (err) {
      console.error('[RalphLoopProgress] Stop error:', err);
      setError('Failed to stop task');
    } finally {
      setStopping(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 5 seconds while task is running
    const interval = setInterval(() => {
      if (status?.status === 'running') {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus, status?.status]);

  const getStatusColor = () => {
    switch (status?.status) {
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'stopped': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'stopped': return '⏹️';
      default: return '❓';
    }
  };

  const formatDuration = () => {
    if (!status) return '';
    const start = new Date(status.startedAt);
    const last = new Date(status.lastIterationAt);
    const durationMs = last.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const progressPercent = status
    ? Math.round((status.currentIteration / status.maxIterations) * 100)
    : 0;

  if (loading && !status) {
    return (
      <div className="bg-white rounded-xl border border-pink-100 p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600">Loading task status...</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (compact) {
    if (loading && !status) return <div className="text-[10px] text-gray-400 animate-pulse">Checking Ralph Status...</div>;
    if (error || !status) return null;

    return (
      <div className="flex items-center gap-3 bg-white/40 p-2 rounded-xl border border-pink-50">
        <span className="text-sm">{getStatusIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Ralph: {status.status}</span>
            <span className="text-[9px] font-bold text-pink-400">{progressPercent}%</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${status.status === 'running' ? 'bg-pink-400' : 'bg-green-400'}`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
        {status.status === 'running' && (
          <button
            onClick={(e) => { e.stopPropagation(); stopTask(); }}
            disabled={stopping}
            className="text-[9px] font-black bg-red-50 text-red-500 px-2 py-0.5 rounded-lg hover:bg-red-100 transition-all"
          >
            STOP
          </button>
        )}
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getStatusIcon()}</span>
          <div>
            <p className="font-medium text-gray-800 text-sm">Ralph Loop Task</p>
            <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getStatusColor()}`}>
              {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
            </p>
          </div>
        </div>
        {status.status === 'running' && (
          <button
            onClick={stopTask}
            disabled={stopping}
            className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            {stopping ? 'Stopping...' : 'Stop'}
          </button>
        )}
      </div>

      {/* Prompt */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-2" title={status.prompt}>
        "{status.prompt}"
      </p>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>Iteration {status.currentIteration}/{status.maxIterations}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${status.status === 'running'
              ? 'bg-gradient-to-r from-pink-500 to-purple-500'
              : status.status === 'completed'
                ? 'bg-green-500'
                : status.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Duration: {formatDuration()}</span>
        <span>ID: {status.taskId.substring(0, 8)}...</span>
      </div>

      {/* Running animation */}
      {status.status === 'running' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce delay-150"></div>
            </div>
            <span className="text-xs text-gray-500">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to execute a new Ralph task
export const RalphTaskExecutor: React.FC<{
  onTaskStarted?: (taskId: string) => void;
}> = ({ onTaskStarted }) => {
  const [prompt, setPrompt] = useState('');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [waitingForApproval, setWaitingForApproval] = useState(false);

  const executeTask = async () => {
    if (!prompt.trim()) return;

    try {
      setExecuting(true);
      setError(null);
      console.log('[RalphTaskExecutor] Requesting approval for:', prompt);

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'dev-user-001',
          actionType: 'RALPH_LOOP_START',
          actionData: { prompt: prompt.trim() }
        })
      });

      const result = await response.json();
      if (result.success) {
        setApprovalId(result.data.id);
        setWaitingForApproval(true);
      } else {
        setError(result.error || 'Failed to request approval');
        setExecuting(false);
      }
    } catch (err) {
      console.error('[RalphTaskExecutor] Error:', err);
      setError('Failed to connect to server');
      setExecuting(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (waitingForApproval && approvalId) {
      interval = setInterval(async () => {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/approvals/${approvalId}`);
          const data = await resp.json();
          if (data.success && data.data.status === 'approved') {
            setWaitingForApproval(false);
            actuallyStartLoop(prompt);
          } else if (data.success && data.data.status === 'rejected') {
            setWaitingForApproval(false);
            setExecuting(false);
            setError('Task start was rejected by human.');
            setApprovalId(null);
          }
        } catch (err) {
          console.error('Error polling approval');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [waitingForApproval, approvalId, prompt]);

  const actuallyStartLoop = async (taskPrompt: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ralph/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: taskPrompt.trim() })
      });

      const result = await response.json();
      if (result.success) {
        setActiveTaskId(result.taskId);
        onTaskStarted?.(result.taskId);
        setPrompt('');
      } else {
        setError(result.error || 'Failed to start Ralph Loop after approval');
        setExecuting(false);
      }
    } catch (err) {
      setError('Connection error starting loop');
      setExecuting(false);
    }
  };

  return (
    <div className="kawaii-card p-6">
      <h3 className="text-xl font-bold text-pink-600 mb-2">Multi-Step Task Executor</h3>
      <p className="text-xs text-gray-500 mb-4">
        Ralph Loop autonomously completes multi-step tasks. Use phrases like "research and create", "analyze and report".
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Research competitors and create a summary..."
          className="flex-1 bg-white border border-pink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          disabled={executing}
        />
        <button
          onClick={executeTask}
          disabled={executing || !prompt.trim()}
          className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm px-4 py-2 disabled:opacity-50"
        >
          {waitingForApproval ? 'Waiting for Approval...' : executing ? 'Starting...' : 'Execute'}
        </button>
      </div>

      {activeTaskId && (
        <RalphLoopProgress
          taskId={activeTaskId}
          onComplete={(status) => {
            if (status.status !== 'running') {
              // Keep showing for a bit after completion
              setTimeout(() => setActiveTaskId(null), 5000);
            }
          }}
        />
      )}
    </div>
  );
};

export default RalphLoopProgress;
