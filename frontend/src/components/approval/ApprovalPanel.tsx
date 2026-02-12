import React, { useState, useEffect, useCallback } from 'react';
import ApprovalCard from './ApprovalCard';
import { Approval } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface ApprovalPanelProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ApprovalPanel: React.FC<ApprovalPanelProps> = ({
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      console.log('[ApprovalPanel] Fetching pending approvals...');
      const response = await fetch(`${API_BASE_URL}/api/approvals/pending`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[ApprovalPanel] Received:', result);

      if (result.success && result.data?.approvals) {
        setApprovals(result.data.approvals);
        setError(null);
      } else {
        setApprovals([]);
      }
    } catch (err) {
      console.error('[ApprovalPanel] Error fetching approvals:', err);
      setError('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();

    if (autoRefresh) {
      const interval = setInterval(fetchPendingApprovals, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPendingApprovals, autoRefresh, refreshInterval]);

  const handleApprove = async (id: string) => {
    try {
      console.log('[ApprovalPanel] Approving:', id);
      console.log('[ApprovalPanel] URL:', `${API_BASE_URL}/api/approvals/${id}/approve`);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Send empty object to satisfy JSON parser
      });

      console.log('[ApprovalPanel] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ApprovalPanel] Error response:', errorText);
        throw new Error(`Failed to approve: ${response.status}`);
      }

      const result = await response.json();
      console.log('[ApprovalPanel] Approved:', result);

      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== id));
      setError(null);
    } catch (err) {
      console.error('[ApprovalPanel] Error approving:', err);
      setError('Failed to approve action');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      console.log('[ApprovalPanel] Rejecting:', id);
      console.log('[ApprovalPanel] URL:', `${API_BASE_URL}/api/approvals/${id}/reject`);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      });

      console.log('[ApprovalPanel] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ApprovalPanel] Error response:', errorText);
        throw new Error(`Failed to reject: ${response.status}`);
      }

      const result = await response.json();
      console.log('[ApprovalPanel] Rejected:', result);

      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== id));
      setError(null);
    } catch (err) {
      console.error('[ApprovalPanel] Error rejecting:', err);
      setError('Failed to reject action');
    }
  };

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">Pending Approvals</h3>
        <button
          onClick={fetchPendingApprovals}
          className="text-sm text-pink-600 hover:text-pink-800 transition-colors"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && approvals.length === 0 ? (
        <div className="text-center py-8">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
          </div>
          <p className="text-gray-500 mt-2">Loading approvals...</p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✓</div>
          <p>No pending approvals</p>
          <p className="text-xs mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 text-center">
        {autoRefresh && `Auto-refreshing every ${refreshInterval / 1000}s`}
      </div>
    </div>
  );
};

export default ApprovalPanel;
