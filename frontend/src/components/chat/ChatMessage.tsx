import React from 'react';
import clsx from 'clsx';
import { ChatMessage as ChatMessageType } from '../../../../shared/types';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isOwn = false }) => {
  return (
    <div className={clsx(
      'kawaii-chat-bubble max-w-[80%] mb-4',
      isOwn
        ? 'kawaii-chat-bubble-user ml-auto bg-gradient-to-r from-pink-500 to-purple-600 text-white'
        : 'kawaii-chat-bubble-assistant mr-auto bg-white border border-pink-100'
    )}>
      <div className="text-sm">{message.content}</div>
      <div className={clsx(
        'text-xs mt-1 opacity-70',
        isOwn ? 'text-white' : 'text-gray-500'
      )}>
        {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
    </div>
  );
};

export default ChatMessage;