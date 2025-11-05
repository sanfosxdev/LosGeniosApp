import { OrderStatus, OrderType, PaymentMethod, CreatedBy, type Order, type StatusHistory } from '../types';
import { addNotification } from './notificationService';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const ORDERS_STORAGE_KEY = 'pizzeria-orders';
const SHEET_NAME = 'Orders';

let ordersCache: Order[] | null = null;

// Helper function to remove undefined properties from an object
const cleanUndefined = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

export const updateCaches = (orders: Order[]) => {
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
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getOrdersFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getOrdersFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const orders = querySnapshot.docs.map(doc => doc.data() as Order);
        updateCaches(orders);
        return orders;
    } catch (error) {
        console.warn('Failed to fetch orders from Firebase, using local cache.', error);
        return getOrdersFromCache();
    }
};

export const saveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid'>): Promise<Order> => {
  const now = new Date().toISOString();
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
  
  try {
      await setDoc(doc(db, SHEET_NAME, newOrder.id), cleanUndefined(newOrder));
      updateCaches([newOrder, ...getOrdersFromCache()]);
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
    
    try {
        await setDoc(doc(db, SHEET_NAME, updatedOrder.id), cleanUndefined(updatedOrder));
        const newCache = [...orders];
        newCache[orderIndex] = updatedOrder;
        updateCaches(newCache);
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
    
    try {
        await setDoc(doc(db, SHEET_NAME, order.id), cleanUndefined(order));
        const newCache = [...orders];
        newCache[orderIndex] = order;
        updateCaches(newCache);
        addNotification({ message: `El pedido #${order.id.split('-')[1]} (${order.customer.name}) cambió a: ${status}.`, type: 'order', relatedId: order.id });
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
    
    try {
        await setDoc(doc(db, SHEET_NAME, order.id), cleanUndefined(order));
        const newCache = [...orders];
        newCache[orderIndex] = order;
        updateCaches(newCache);
        addNotification({ message: `Se aprobó el pago para el pedido #${orderId.split('-')[1]} de ${order.customer.name}.`, type: 'order', relatedId: orderId });
        return order;
    } catch (e) {
        throw new Error(`Error al actualizar pago en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, SHEET_NAME, orderId));
        updateCaches(getOrdersFromCache().filter(o => o.id !== orderId));
    } catch (e) {
        throw new Error(`Error al eliminar pedido en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};