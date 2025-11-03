

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminSidebar from './AdminSidebar';
import OrdersPanel from './OrdersPanel';
import ProductsPanel from './ProductsPanel';
import CustomersPanel from './CustomersPanel';
import SchedulePanel from './SchedulePanel';
import ReservationsPanel from './ReservationsPanel';
import TablesPanel from './TablesPanel';
import BotsPanel from './BotsPanel';
import SettingsPanel from './SettingsPanel';
import { MenuIcon } from '../icons/MenuIcon';
import { PizzaIcon } from '../icons/PizzaIcon';
import * as notificationService from '../../services/notificationService';
import * as whatsAppBotService from '../../services/whatsappBotService';
import { fetchAndCacheOrders, getOrdersFromCache } from '../../services/orderService';
import { fetchAndCacheReservations, getReservationsFromCache, fetchAndCacheReservationSettings } from '../../services/reservationService';
import { fetchAndCacheProducts } from '../../services/productService';
import { fetchAndCacheCategories } from '../../services/categoryService';
import { fetchAndCachePromotions } from '../../services/promotionService';
import { fetchAndCacheCustomerCategories } from '../../services/customerCategoryService';
import { fetchAndCacheCustomers } from '../../services/customerService';
import { fetchAndCacheTables } from '../../services/tableService';
import { fetchAndCacheScheduleExceptions } from '../../services/scheduleExceptionService';
import { fetchAndCacheSliceBotData } from '../../services/sliceBotMetricsService';
import { fetchAndCacheWhatsAppBotData } from '../../services/whatsappBotMetricsService';
import { syncLocalDataToSheet } from '../../services/settingsService';
import NotificationCenter from './NotificationCenter';
import SyncButton from './SyncButton';
import type { Notification, WhatsAppBotStatus, BulkSendJob } from '../../types';
import type { SliceBotStatus } from '../../services/sliceBotService';
import { ReservationStatus } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';


interface AdminDashboardProps {
  onGoToSite: () => void;
  onSliceBotStatusChange: (newStatus: SliceBotStatus) => void;
}

type AdminPanel = 'orders' | 'products' | 'customers' | 'schedule' | 'reservations' | 'tables' | 'bots' | 'settings';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onGoToSite, onSliceBotStatusChange }) => {
  const [activePanel, setActivePanel] = useState<AdminPanel>('orders');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getNotifications());
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppBotStatus>(
    () => whatsAppBotService.getPersistedStatus() === 'active' ? 'active' : 'disconnected'
  );
  const [lastStatusCheck, setLastStatusCheck] = useState<Date | null>(null);
  const [bulkSendJob, setBulkSendJob] = useState<BulkSendJob | null>(null);
  const [dataTimestamp, setDataTimestamp] = useState(Date.now());
  const lastCheckedOrder = useRef<string | null>(null);
  
  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);


  const whatsAppStatusRef = useRef(whatsAppStatus);
  whatsAppStatusRef.current = whatsAppStatus;

  const refreshNotifications = useCallback(() => {
    setNotifications(notificationService.getNotifications());
  }, []);
  
  const checkWhatsAppStatus = useCallback(async (force = false) => {
    const currentStatus = whatsAppStatusRef.current;
    if (!force && ['initiating', 'scanning', 'disconnecting'].includes(currentStatus)) {
        return;
    }

    try {
        const apiStatus = await whatsAppBotService.getWhatsAppStatus();
        let newStatus: WhatsAppBotStatus;
        switch (apiStatus) {
            case 'ACTIVE': newStatus = 'active'; break;
            case 'READY_TO_SCAN': newStatus = 'ready_to_scan'; break;
            default: newStatus = 'disconnected';
        }

        if (newStatus !== whatsAppStatusRef.current) {
            setWhatsAppStatus(newStatus);
            whatsAppBotService.persistStatus(newStatus === 'active' ? 'active' : 'disconnected');
        }
    } catch (err) {
        console.error("Failed to check WhatsApp status", err);
        if (whatsAppStatusRef.current !== 'error') {
            setWhatsAppStatus('error');
        }
    } finally {
        setLastStatusCheck(new Date());
    }
  }, []);
  
  const pollDataAndCheckSystem = useCallback(async () => {
    let isMounted = true;
    
    const checkSystem = () => {
      if (!isMounted) return;
      const currentOrders = getOrdersFromCache();
      if (currentOrders.length > 0 && lastCheckedOrder.current && currentOrders[0].id !== lastCheckedOrder.current) {
        notificationService.addNotification({
          message: `Nuevo pedido de ${currentOrders[0].customer.name} por $${currentOrders[0].total.toLocaleString('es-AR')}.`,
          type: 'order',
          relatedId: currentOrders[0].id,
        });
        lastCheckedOrder.current = currentOrders[0].id;
        refreshNotifications();
      }

      const upcomingReservations = getReservationsFromCache().filter(r => {
        if (r.status !== ReservationStatus.CONFIRMED) return false;
        const diffMinutes = (new Date(r.reservationTime).getTime() - Date.now()) / 60000;
        return diffMinutes > 0 && diffMinutes <= 15;
      });

      let newNotificationAdded = false;
      upcomingReservations.forEach(res => {
        const added = notificationService.addNotification({
          message: `La reserva para ${res.customerName} (${res.guests}p) comienza en menos de 15 minutos.`,
          type: 'reservation',
          relatedId: res.id,
        });
        if (added) newNotificationAdded = true;
      });
      
      if (newNotificationAdded) refreshNotifications();
    };

    try {
        await Promise.all([
            fetchAndCacheOrders(),
            fetchAndCacheReservations(),
            fetchAndCacheProducts(),
            fetchAndCacheCategories(),
            fetchAndCachePromotions(),
            fetchAndCacheCustomerCategories(),
            fetchAndCacheCustomers(),
            fetchAndCacheTables(),
            fetchAndCacheScheduleExceptions(),
            fetchAndCacheSliceBotData(),
            fetchAndCacheWhatsAppBotData(),
            fetchAndCacheReservationSettings(),
        ]);
        if (isMounted) {
            setDataTimestamp(Date.now());
            checkSystem();
        }
    } catch (error) {
        console.warn("Data polling failed:", error);
        throw error;
    }
    
    return () => { isMounted = false; };
  }, [refreshNotifications]);
  
  const handleManualSync = async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await syncLocalDataToSheet();
      await pollDataAndCheckSystem();
      setLastSyncTime(new Date());
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      console.error("Manual sync failed:", error);
      setSyncStatus('error');
      setSyncError(`Error de sincronización: ${message}`);
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };


  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
        await pollDataAndCheckSystem();
        if (isMounted) {
            const initialOrders = getOrdersFromCache();
            if (initialOrders.length > 0) {
                lastCheckedOrder.current = initialOrders[0].id;
            }
            setLastSyncTime(new Date());
        }
        checkWhatsAppStatus(true);
    };

    initialLoad();

    const dataPollIntervalId = setInterval(pollDataAndCheckSystem, 60000 * 5); // Poll data every 5 minutes

    let whatsAppPollIntervalId: number | undefined;
    const whatsAppIntervalDuration = activePanel === 'bots' ? 15000 : (whatsAppStatus === 'active' ? 30000 : 0);
    if (whatsAppIntervalDuration > 0) {
        whatsAppPollIntervalId = window.setInterval(() => checkWhatsAppStatus(), whatsAppIntervalDuration);
    }

    return () => {
      isMounted = false;
      clearInterval(dataPollIntervalId);
      if (whatsAppPollIntervalId) clearInterval(whatsAppPollIntervalId);
    };
  }, [activePanel, whatsAppStatus, checkWhatsAppStatus, pollDataAndCheckSystem]);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
    refreshNotifications();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
    refreshNotifications();
  };

  const handleDelete = (id: string) => {
    notificationService.deleteNotification(id);
    refreshNotifications();
  };
  
  const handleClearAll = () => {
    notificationService.clearAllNotifications();
    refreshNotifications();
  };
  
  const syncComponent = (
    <SyncButton
      status={syncStatus}
      lastSyncTime={lastSyncTime}
      onSync={handleManualSync}
    />
  );
  
  const notificationCenterComponent = (
     <NotificationCenter
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
    />
  );

  const renderPanel = () => {
    switch (activePanel) {
      case 'orders':
        return <OrdersPanel onRefreshNotifications={refreshNotifications} dataTimestamp={dataTimestamp} />;
      case 'products':
        return <ProductsPanel dataTimestamp={dataTimestamp} />;
      case 'customers':
        return <CustomersPanel 
                  whatsAppStatus={whatsAppStatus}
                  bulkSendJob={bulkSendJob}
                  setBulkSendJob={setBulkSendJob}
                  dataTimestamp={dataTimestamp}
                />;
      case 'schedule':
        return <SchedulePanel />;
      case 'reservations':
        return <ReservationsPanel onRefreshNotifications={refreshNotifications} dataTimestamp={dataTimestamp} />;
      case 'tables':
        return <TablesPanel dataTimestamp={dataTimestamp} />;
      case 'bots':
        return <BotsPanel 
                    status={whatsAppStatus} 
                    setStatus={setWhatsAppStatus} 
                    checkStatus={checkWhatsAppStatus}
                    lastStatusCheck={lastStatusCheck}
                    onSliceBotStatusChange={onSliceBotStatusChange} 
                />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <OrdersPanel onRefreshNotifications={refreshNotifications} dataTimestamp={dataTimestamp} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      <AdminSidebar 
        activePanel={activePanel} 
        onPanelChange={(panel) => setActivePanel(panel)} 
        onGoToSite={onGoToSite} 
        isSidebarOpen={isSidebarOpen}
        onSidebarClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 dark:text-gray-300">
                <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2">
                <PizzaIcon className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold font-display text-dark dark:text-light">Panel Admin</span>
            </div>
            <div className="flex items-center gap-2">
              {syncComponent}
              {notificationCenterComponent}
            </div>
        </header>

         {/* Desktop Header */}
        <header className="hidden lg:flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 justify-end items-center">
            <div className="flex items-center gap-4">
                {syncComponent}
                {notificationCenterComponent}
            </div>
        </header>
        
        {syncError && (
          <div className="relative bg-red-100 dark:bg-red-900/50 border-b border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-2 text-sm text-center">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} className="absolute top-1/2 right-3 -translate-y-1/2 p-1">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;