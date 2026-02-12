import React from 'react';
import { EmailMessage } from '../../../../shared/types';

interface EmailNotificationProps {
  email: EmailMessage;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}

const EmailNotification: React.FC<EmailNotificationProps> = ({ email, onApprove, onReject, onEdit }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 border-l-4 border-pink-500">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg text-pink-600">{email.subject}</h3>
          <p className="text-sm text-gray-500">From: {email.sender}</p>
          <p className="text-sm mt-2 line-clamp-2">{email.body.substring(0, 100)}...</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          email.importance === 'critical' ? 'bg-red-100 text-red-800' :
          email.importance === 'high' ? 'bg-orange-100 text-orange-800' :
          email.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          email.importance === 'low' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {email.importance}
        </span>
      </div>

      {email.draftReply && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-700 text-sm">Draft Reply:</h4>
          <p className="text-sm mt-1">{email.draftReply}</p>
        </div>
      )}

      {email.status === 'action-required' && (
        <div className="mt-4 flex gap-2">
          {onApprove && (
            <button
              onClick={onApprove}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Approve & Send
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Edit Reply
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailNotification;