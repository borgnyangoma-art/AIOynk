import React, { useEffect, useState } from 'react';

interface TypingIndicatorProps {
  users?: string[];
  isVisible: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  users = [],
  isVisible,
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 max-w-[200px]">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {users.length > 0
              ? `${users.join(', ')} typing${users.length > 1 ? '' : ''}`
              : 'AI is typing'}
            {dots}
          </span>
        </div>
      </div>
    </div>
  );
};
