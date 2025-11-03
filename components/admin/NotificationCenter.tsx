import React, { useState, useEffect, useRef } from 'react';
import type { Notification } from '../../types';
import { BellIcon } from '../icons/BellIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { CloseIcon } from '../icons/CloseIcon';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " años";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " días";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min";
    return "Ahora";
};


const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch(type) {
        case 'order': return <PackageIcon className="w-6 h-6 text-blue-500" />;
        case 'reservation': return <CalendarIcon className="w-6 h-6 text-green-500" />;
        default: return <BellIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={handleToggle} className="relative text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-secondary p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs font-bold items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50 animate-fade-in overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-3 flex justify-between items-center border-b dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-gray-100">Notificaciones</h4>
            {unreadCount > 0 && (
                 <button onClick={onMarkAllAsRead} className="text-xs text-primary hover:underline">Marcar todas como leídas</button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-10">No hay notificaciones</p>
            ) : (
              <ul>
                {notifications.map(n => (
                  <li 
                    key={n.id} 
                    className={`border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    onClick={() => onMarkAsRead(n.id)}
                  >
                    <div className="p-3 flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">{getNotificationIcon(n.type)}</div>
                      <div className="flex-grow">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{n.message}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(n.id); }} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
           {notifications.length > 0 && (
                <div className="p-2 border-t dark:border-gray-700 text-center">
                    <button onClick={onClearAll} className="text-xs text-red-500 hover:underline">Limpiar todo</button>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
