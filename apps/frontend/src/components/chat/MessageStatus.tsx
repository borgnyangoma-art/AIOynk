import React from 'react';
import { Check, CheckCheck, Clock, X } from 'lucide-react';

export type MessageStatusType = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusProps {
  status: MessageStatusType;
  timestamp?: string;
  className?: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  timestamp,
  className = '',
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock size={14} className="text-gray-400" />;
      case 'sent':
        return <Check size={14} className="text-gray-400" />;
      case 'delivered':
        return <CheckCheck size={14} className="text-gray-400" />;
      case 'read':
        return <CheckCheck size={14} className="text-blue-400" />;
      case 'failed':
        return <X size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      case 'failed':
        return 'Failed';
      default:
        return '';
    }
  };

  if (!timestamp && status === 'sent') return null;

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {getStatusIcon()}
      {timestamp && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      )}
      {status === 'failed' && (
        <span className="text-xs text-red-500">Tap to retry</span>
      )}
    </div>
  );
};
