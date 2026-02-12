import React from 'react';
import ApprovalButton from '../ui/ApprovalButton';
import { Approval } from '../../../../shared/types';

interface ApprovalCardProps {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({ approval, onApprove, onReject }) => {
  const handleApprove = () => {
    onApprove(approval.id);
  };

  const handleReject = () => {
    onReject(approval.id);
  };

  return (
    <div className="kawaii-card p-4 mb-4 border-l-4 border-pink-500">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-pink-600 capitalize">{approval.actionType.replace('_', ' ')}</h4>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(approval.requestedAt).toLocaleString()}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          approval.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          approval.status === 'approved' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {approval.status}
        </span>
      </div>

      <div className="mt-3 p-3 bg-pink-50 rounded-lg">
        <h5 className="font-medium text-pink-700 text-sm">Action Details:</h5>
        <pre className="text-xs text-gray-700 mt-1 overflow-x-auto">
          {JSON.stringify(approval.actionData, null, 2)}
        </pre>
      </div>

      {approval.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <ApprovalButton
            type="approve"
            onClick={handleApprove}
          />
          <ApprovalButton
            type="reject"
            onClick={handleReject}
          />
        </div>
      )}

      {approval.rejectionReason && (
        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
          <strong>Rejection Reason:</strong> {approval.rejectionReason}
        </div>
      )}
    </div>
  );
};

export default ApprovalCard;