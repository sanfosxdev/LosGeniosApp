
import React from 'react';
import { RefreshIcon } from '../icons/RefreshIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';

interface SyncButtonProps {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: Date | null;
  onSync: () => void;
}

const SyncButton: React.FC<SyncButtonProps> = ({ status, lastSyncTime, onSync }) => {
  const getIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshIcon className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'idle':
      default:
        return <RefreshIcon className="w-5 h-5" />;
    }
  };

  const getMessage = () => {
    if (status === 'syncing') return 'Sincronizando...';
    if (status === 'success') return 'Actualizado ✓';
    if (status === 'error') return 'Error';
    if (lastSyncTime) return `Últ. act: ${lastSyncTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    return 'Sincronizar';
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <button
        onClick={onSync}
        disabled={status === 'syncing'}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed transition-colors"
        title="Sincronizar con Google Sheet"
      >
        {getIcon()}
      </button>
      <span className="hidden md:inline-block min-w-[120px] text-left">{getMessage()}</span>
    </div>
  );
};

export default SyncButton;
