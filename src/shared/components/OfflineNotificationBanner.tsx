import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OfflineNotificationBanner: React.FC = () => {
  const { isOnline, wentOfflineAt, justReconnected, checkConnection } = useNetworkStatus();

  if (isOnline && !justReconnected) {
    return null;
  }

  if (justReconnected) {
    return (
      <aside aria-label="Reconnection Notice" className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between shadow-md transition-all duration-300 relative z-50">
        <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
          <span className="material-symbols-outlined text-[18px]">cloud_done</span>
          <span className="font-medium">
            <strong>Connection Restored:</strong> You are back online. SAP Gateway requests will now process normally.
          </span>
        </div>
      </aside>
    );
  }

  const formatOfflineTime = (date: Date | null) => {
    if (!date) return 'just now';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <aside aria-label="Offline Mode Warning" className="bg-amber-600 text-white text-xs px-4 py-2.5 shadow-lg border-b border-amber-700/50 transition-all duration-300 relative z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] animate-pulse text-amber-200">
            cloud_off
          </span>
          <div>
            <span className="font-bold tracking-wide uppercase text-[11px] bg-amber-800/80 px-2 py-0.5 rounded mr-2">
              Offline Mode
            </span>
            <span className="font-medium">
              Network connection disconnected at {formatOfflineTime(wentOfflineAt)}.
            </span>
            <span className="hidden md:inline ml-1 text-amber-100">
              Your edits are automatically safely preserved in local draft storage.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => checkConnection()}
            className="px-2.5 py-1 bg-amber-800/80 hover:bg-amber-900 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors border border-amber-500/30"
            title="Check if network connection is restored"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>Check Network</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
