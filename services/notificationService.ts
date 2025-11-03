import type { Notification } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'pizzeria-notifications';

const persistNotifications = (notifications: Notification[]): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Failed to save notifications to localStorage", error);
  }
};

export const getNotifications = (): Notification[] => {
  try {
    const notificationsJson = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const notifications = notificationsJson ? JSON.parse(notificationsJson) as Notification[] : [];
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Failed to parse notifications from localStorage", error);
    return [];
  }
};

export const addNotification = (notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Notification | null => {
  const existingNotifications = getNotifications();

  // Prevent duplicate notifications for the same event
  if (notificationData.relatedId && existingNotifications.some(n => n.relatedId === notificationData.relatedId)) {
    return null;
  }

  const newNotification: Notification = {
    ...notificationData,
    id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  const updatedNotifications = [newNotification, ...existingNotifications].slice(0, 50); // Keep max 50 notifications
  persistNotifications(updatedNotifications);
  return newNotification;
};

export const markAsRead = (notificationId: string): void => {
  const notifications = getNotifications();
  const notificationIndex = notifications.findIndex(n => n.id === notificationId);
  if (notificationIndex > -1) {
    notifications[notificationIndex].isRead = true;
    persistNotifications(notifications);
  }
};

export const markAllAsRead = (): void => {
  const notifications = getNotifications().map(n => ({ ...n, isRead: true }));
  persistNotifications(notifications);
};

export const deleteNotification = (notificationId: string): void => {
  const notifications = getNotifications().filter(n => n.id !== notificationId);
  persistNotifications(notifications);
};

export const clearAllNotifications = (): void => {
  persistNotifications([]);
};

export const getUnreadCount = (): number => {
  return getNotifications().filter(n => !n.isRead).length;
};
