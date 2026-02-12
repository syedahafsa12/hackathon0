import React from 'react';

interface ApprovalButtonProps {
  type: 'approve' | 'reject' | 'edit';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const ApprovalButton: React.FC<ApprovalButtonProps> = ({ type, onClick, disabled = false, className = '' }) => {
  const buttonStyles = {
    approve: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
    reject: 'bg-gradient-to-r from-red-500 to-rose-600 text-white',
    edit: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
  };

  const buttonText = {
    approve: 'Approve',
    reject: 'Reject',
    edit: 'Edit'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${buttonStyles[type]} px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity ${className}`}
    >
      {buttonText[type]}
    </button>
  );
};

export default ApprovalButton;