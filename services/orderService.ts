import { OrderStatus, OrderType, PaymentMethod, CreatedBy, type Order, type StatusHistory } from '../types';
import { addNotification } from './notificationService';
import apiService from './apiService';

const ORDERS_STORAGE_KEY = 'pizzeria-orders';
const SHEET_NAME = 'Orders';

let ordersCache: Order[] | null = null;

const updateCaches = (orders: Order[]) => {
    ordersCache = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordersCache));
};

const initializeOrders = () => {
    try {
        const localData = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (localData) {
            ordersCache = JSON.parse(localData);
        } else {
            ordersCache = [];
        }
    } catch(e) {
        console.error(e);
        ordersCache = [];
    }
};

initializeOrders();

const FINISHED_STATUSES: OrderStatus[] = [
    OrderStatus.COMPLETED_PICKUP,
    OrderStatus.COMPLETED_DELIVERY,
    OrderStatus.COMPLETED_DINE_IN,
    OrderStatus.CANCELLED,
];

export const isOrderFinished = (status: OrderStatus): boolean => {
    return FINISHED_STATUSES.includes(status) || status === ('Completado' as any);
}

export const getOrdersFromCache = (): Order[] => {
    return ordersCache || [];
};

export const fetchAndCacheOrders = async (): Promise<Order[]> => {
    try {
        const orders = await apiService.get(SHEET_NAME);
        // Data migration to ensure tableIds is always an array
        orders.forEach((order: any) => {
            if (typeof order.tableIds === 'string') {
                if (order.tableIds.startsWith('[')) {
                    try { 
                        const parsed = JSON.parse(order.tableIds);
                        order.tableIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) { 
                        order.tableIds = [];
                    }
                } else if (order.tableIds.trim()) {
                    order.tableIds = order.tableIds.split(',').map(s => s.trim());
                } else {
                    order.tableIds = [];
                }
            } else if (order.tableIds && !Array.isArray(order.tableIds)) {
                // Handle other truthy non-array types like numbers
                order.tableIds = [String(order.tableIds)];
            } else if (!order.tableIds) {
                order.tableIds = [];
            }
        });
        updateCaches(orders);
        return orders;
    } catch (error) {
        console.warn('Failed to fetch orders, using local cache.', error);
        return getOrdersFromCache();
    }
};

export const saveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid'>): Promise<Order> => {
  const now = new Date().toISOString();
  // An order is only considered paid at creation time if a payment proof is provided.
  // Otherwise, payment is confirmed manually by an admin via markOrderAsPaid or by completing the order.
  const isPaid = !!orderData.paymentProofUrl;

  const newOrder: Order = {
    ...orderData,
    id: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: OrderStatus.PENDING,
    createdAt: now,
    statusHistory: [{ status: OrderStatus.PENDING, startedAt: now }],
    finishedAt: null,
    isPaid: isPaid,
  };
  
  updateCaches([newOrder, ...getOrdersFromCache()]);

  try {
      await apiService.post('addData', { sheetName: SHEET_NAME, item: newOrder });
      return newOrder;
  } catch (e) {
      throw new Error(`Error al guardar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateOrder = async (orderUpdates: Partial<Order> & { id: string }): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderUpdates.id);
    if (orderIndex === -1) throw new Error("Order not found");

    const updatedOrder = { ...orders[orderIndex], ...orderUpdates };
    const newCache = [...orders];
    newCache[orderIndex] = updatedOrder;
    updateCaches(newCache);
    
    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedOrder });
        return updatedOrder;
    } catch (e) {
        throw new Error(`Error al actualizar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error(`Order with id ${orderId} not found.`);
    
    const order = { ...orders[orderIndex] };

    if (isOrderFinished(order.status)) return order;
    if ((status === OrderStatus.COMPLETED_PICKUP || status === OrderStatus.COMPLETED_DELIVERY || status === OrderStatus.COMPLETED_DINE_IN) && !order.isPaid) {
        throw new Error('No se puede completar un pedido cuyo pago no ha sido aprobado.');
    }
    if (order.status === OrderStatus.CONFIRMED && status === OrderStatus.PREPARING && order.type === OrderType.DELIVERY && !order.isPaid) {
        throw new Error('Un pedido con envío no puede pasar a preparación hasta que el pago sea aprobado.');
    }
    
    order.status = status;
    order.statusHistory.push({ status, startedAt: new Date().toISOString() });

    if (isOrderFinished(status)) {
        order.finishedAt = new Date().toISOString();
        if (status !== OrderStatus.CANCELLED) order.isPaid = true;
    }

    const newCache = [...orders];
    newCache[orderIndex] = order;
    updateCaches(newCache);
    
    addNotification({ message: `El pedido #${order.id.split('-')[1]} (${order.customer.name}) cambió a: ${status}.`, type: 'order', relatedId: order.id });

    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: order });
        return order;
    } catch (e) {
        throw new Error(`Error al actualizar estado en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const markOrderAsPaid = async (orderId: string, paymentMethod: PaymentMethod, paymentProofUrl?: string | null): Promise<Order> => {
    const orders = getOrdersFromCache();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error(`Order with id ${orderId} not found.`);
    
    const order = { ...orders[orderIndex] };
    order.isPaid = true;
    order.paymentMethod = paymentMethod;
    if (paymentProofUrl !== undefined) order.paymentProofUrl = paymentProofUrl;
    
    const newCache = [...orders];
    newCache[orderIndex] = order;
    updateCaches(newCache);

    addNotification({ message: `Se aprobó el pago para el pedido #${orderId.split('-')[1]} de ${order.customer.name}.`, type: 'order', relatedId: orderId });
    
    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: order });
        return order;
    } catch (e) {
        throw new Error(`Error al actualizar pago en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
    updateCaches(getOrdersFromCache().filter(o => o.id !== orderId));
    try {
        await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: orderId });
    } catch (e) {
        throw new Error(`Error al eliminar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};
