import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { createSession, setCurrentSession } from '../../store/slices/sessionSlice';
import { Session } from '../../types';

interface ConversationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useDispatch();
  const sessions = useSelector((state: RootState) => state.session.sessions);
  const currentSessionId = useSelector((state: RootState) => state.session.currentSession?.id);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSession = (session: Session) => {
    dispatch(setCurrentSession(session));
    onClose();
  };

  const handleNewConversation = () => {
    dispatch(createSession());
    onClose();
  };

  const getSessionPreview = (session: Session) => {
    if (session.messages.length === 0) return 'No messages yet';
    const lastMessage = session.messages[session.messages.length - 1];
    return lastMessage.content.length > 50
      ? `${lastMessage.content.substring(0, 50)}...`
      : lastMessage.content;
  };

  const formatDate = (date: string) => {
    const now = new Date();
    const sessionDate = new Date(date);
    const diffInHours = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return sessionDate.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      <div className="w-80 bg-white dark:bg-gray-800 shadow-xl flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Conversations
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New Conversation
          </button>
          <div className="mt-4 relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
              <MessageSquare size={48} className="mb-4 opacity-50" />
              <p className="text-center">
                {searchQuery
                  ? 'No conversations found'
                  : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    session.id === currentSessionId
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {getSessionPreview(session)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock size={12} />
                        <span>{formatDate(session.createdAt)}</span>
                        {session.messages.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{session.messages.length} messages</span>
                          </>
                        )}
                      </div>
                    </div>
                    {session.id === currentSessionId && (
                      <div className="ml-2 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  );
};
