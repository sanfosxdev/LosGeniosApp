import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminSidebar from './admin/AdminSidebar';
import OrdersPanel from './admin/OrdersPanel';
import ProductsPanel from './admin/ProductsPanel';
import CustomersPanel from './admin/CustomersPanel';
import SchedulePanel from './admin/SchedulePanel';
import ReservationsPanel from './admin/ReservationsPanel';
import TablesPanel from './admin/TablesPanel';
import BotsPanel from './admin/BotsPanel';
import SettingsPanel from './admin/SettingsPanel';
import { MenuIcon } from './icons/MenuIcon';
import { PizzaIcon } from './icons/PizzaIcon';
import * as notificationService from '../services/notificationService';
import * as whatsAppBotService from '../services/whatsappBotService';
import { getOrdersFromCache } from '../services/orderService';
import { getReservationsFromCache } from '../services/reservationService';
import { db, onSnapshot, collection } from '../services/firebase';
import NotificationCenter from './admin/NotificationCenter';
import type { Notification, WhatsAppBotStatus, BulkSendJob } from '../types';
import type { SliceBotStatus } from '../services/sliceBotService';
import { ReservationStatus } from '../types';
import { ToastContainer } from './admin/ToastContainer';

import { updateCaches as updateOrdersCache } from '../services/orderService';
import { updateCaches as updateReservationsCache } from '../services/reservationService';
import { updateCaches as updateProductsCache } from '../services/productService';
import { updateCaches as updateCategoriesCache } from '../services/categoryService';
import { updateCaches as updatePromotionsCache } from '../services/promotionService';
import { updateCaches as updateCustomerCategoriesCache } from '../services/customerCategoryService';
import { updateCaches as updateCustomersCache } from '../services/customerService';
import { updateCaches as updateTablesCache } from '../services/tableService';
import { updateCaches as updateScheduleExceptionsCache } from '../services/scheduleExceptionService';


interface AdminDashboardProps {
  onGoToSite: () => void;
  onSliceBotStatusChange: (newStatus: SliceBotStatus) => void;
}

type AdminPanel = 'orders' | 'products' | 'customers' | 'schedule' | 'reservations' | 'tables' | 'bots' | 'settings';

const FullPageLoader: React.FC = () => (
    <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
            <PizzaIcon className="w-16 h-16 text-primary mx-auto animate-bounce" />
            <p className="text-lg font-semibold mt-4 text-gray-700 dark:text-gray-200">Conectando a la base de datos...</p>
        </div>
    </div>
);

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const lastCheckedOrder = useRef<string | null>(null);
  
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

  useEffect(() => {
    const collectionsToListen = [
      { name: 'Orders', updater: updateOrdersCache },
      { name: 'Reservations', updater: updateReservationsCache },
      { name: 'Products', updater: updateProductsCache },
      { name: 'Categories', updater: updateCategoriesCache },
      { name: 'Promotions', updater: updatePromotionsCache },
      { name: 'CustomerCategories', updater: updateCustomerCategoriesCache },
      { name: 'Customers', updater: updateCustomersCache },
      { name: 'Tables', updater: updateTablesCache },
      { name: 'ScheduleExceptions', updater: updateScheduleExceptionsCache },
    ];

    const unsubscribers = collectionsToListen.map(({ name, updater }) => {
      const q = collection(db, name);
      return onSnapshot(q, (querySnapshot) => {
        const items = querySnapshot.docs.map(doc => doc.data());
        // @ts-ignore
        updater(items);
        setDataTimestamp(Date.now());
        if (isInitialLoading) setIsInitialLoading(false);
      }, (error) => {
        console.error(`Error listening to ${name}:`, error);
        setIsInitialLoading(false);
      });
    });
    
    let whatsAppPollIntervalId: number | undefined;
    const whatsAppIntervalDuration = activePanel === 'bots' ? 15000 : (whatsAppStatus === 'active' ? 30000 : 0);
    if (whatsAppIntervalDuration > 0) {
        whatsAppPollIntervalId = window.setInterval(() => checkWhatsAppStatus(), whatsAppIntervalDuration);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
      if (whatsAppPollIntervalId) clearInterval(whatsAppPollIntervalId);
    };
  }, [isInitialLoading, activePanel, whatsAppStatus, checkWhatsAppStatus]);

  useEffect(() => {
    const currentOrders = getOrdersFromCache();
    if (currentOrders.length > 0 && lastCheckedOrder.current && currentOrders[0].id !== lastCheckedOrder.current) {
      notificationService.addNotification({
        message: `Nuevo pedido de ${currentOrders[0].customer.name} por $${currentOrders[0].total.toLocaleString('es-AR')}.`,
        type: 'order',
        relatedId: currentOrders[0].id,
      });
      refreshNotifications();
    }
    if(currentOrders.length > 0) {
      lastCheckedOrder.current = currentOrders[0].id;
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

  }, [dataTimestamp, refreshNotifications]);
  
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
  
  if (isInitialLoading) {
    return <FullPageLoader />;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      <ToastContainer />
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
              {notificationCenterComponent}
            </div>
        </header>

         {/* Desktop Header */}
        <header className="hidden lg:flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 justify-end items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Conectado en tiempo real</span>
                </div>
                {notificationCenterComponent}
            </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;