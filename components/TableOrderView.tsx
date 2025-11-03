import React, { useState, useEffect, useMemo } from 'react';
import type { Order, Table, Product, Category, Promotion, OrderItem } from '../types';
// Fix: Import PaymentMethod to use it as a default value for new dine-in orders.
import { OrderType, CreatedBy, OrderStatus, PaymentMethod } from '../types';
// Fix: Import fetchAndCacheTables to ensure table data is up-to-date.
import { getEnrichedTableById, getTablesFromCache, fetchAndCacheTables } from '../services/tableService';
import { getOrdersFromCache, saveOrder, updateOrder, updateOrderStatus } from '../services/orderService';
import { getReservationsFromCache } from '../services/reservationService';
import { fetchAndCacheProducts } from '../services/productService';
import { fetchAndCacheCategories } from '../services/categoryService';
import { fetchAndCachePromotions } from '../services/promotionService';

import { PizzaIcon } from './icons/PizzaIcon';
import { Spinner } from './admin/Spinner';
import OrderCart from './table_order/OrderCart';

type LoadingStatus = 'loading' | 'ready' | 'occupied' | 'error' | 'ordered';

const TableOrderView: React.FC<{ tableId: string }> = ({ tableId }) => {
    const [status, setStatus] = useState<LoadingStatus>('loading');
    const [table, setTable] = useState<Table | null>(null);
    const [order, setOrder] = useState<Order | null>(null);
    const [menu, setMenu] = useState<{ products: Product[], promotions: Promotion[], categories: Category[] }>({ products: [], promotions: [], categories: [] });
    const [errorMessage, setErrorMessage] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            try {
                // Fetch all data first
                const [products, categories, promotions] = await Promise.all([
                    fetchAndCacheProducts(),
                    fetchAndCacheCategories(),
                    fetchAndCachePromotions()
                ]);
                setMenu({ products, promotions: promotions.filter(p => p.isActive), categories });

                // Try finding the table in the cache first.
                let tableInfo = getTablesFromCache().find(t => t.id === tableId);

                // If not found, fetch from the source and try again.
                if (!tableInfo) {
                    await fetchAndCacheTables(); // This will update the cache.
                    tableInfo = getTablesFromCache().find(t => t.id === tableId); // Try again.
                }

                if (!tableInfo) {
                    setErrorMessage(`Mesa con ID "${tableId}" no encontrada.`);
                    setStatus('error');
                    return;
                }
                setTable(tableInfo);

                const sessionOrderKey = `pizzeria-table-order-${tableId}`;
                const sessionOrderId = sessionStorage.getItem(sessionOrderKey);
                
                let currentOrder: Order | undefined;
                if(sessionOrderId) {
                    currentOrder = getOrdersFromCache().find(o => o.id === sessionOrderId);
                    if (!currentOrder || currentOrder.status !== OrderStatus.PENDING) {
                        currentOrder = undefined;
                        sessionStorage.removeItem(sessionOrderKey);
                    }
                }

                if (currentOrder) {
                    setOrder(currentOrder);
                    setStatus('ready');
                } else {
                    const enrichedTable = getEnrichedTableById(tableId);
                    if (enrichedTable?.status === 'Libre') {
                        const newOrder = await saveOrder({
                            customer: { name: `Mesa ${tableInfo.name}` },
                            items: [],
                            total: 0,
                            type: OrderType.DINE_IN,
                            tableIds: [tableId],
                            guests: 1, // Default guests, can be adjusted later if needed
                            createdBy: CreatedBy.WEB_ASSISTANT,
                            // Fix: Corrected the type mismatch by setting a default PaymentMethod.
                            // The payment method for dine-in is usually determined at the end, so CASH is a sensible default.
                            paymentMethod: PaymentMethod.CASH,
                        });
                        sessionStorage.setItem(sessionOrderKey, newOrder.id);
                        setOrder(newOrder);
                        setStatus('ready');
                    } else {
                        setErrorMessage(`Esta mesa está actualmente ${enrichedTable?.status.toLowerCase()}. Por favor, consulta con un miembro del personal.`);
                        setStatus('occupied');
                    }
                }
            } catch (err) {
                console.error(err);
                setErrorMessage('Ocurrió un error al cargar la información. Por favor, intenta de nuevo.');
                setStatus('error');
            }
        };

        initialize();
    }, [tableId]);

    const handleUpdateOrder = (newItems: OrderItem[]) => {
        if (!order) return;
        const newTotal = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const updatedOrder = { ...order, items: newItems, total: newTotal };
        setOrder(updatedOrder);
    };

    const handleConfirmOrder = async () => {
        if (!order || order.items.length === 0) return;
        try {
            setStatus('loading');
            await updateOrder({ ...order, status: OrderStatus.CONFIRMED });
            await updateOrderStatus(order.id, OrderStatus.CONFIRMED);
            const sessionOrderKey = `pizzeria-table-order-${tableId}`;
            sessionStorage.removeItem(sessionOrderKey);
            setStatus('ordered');
        } catch (err) {
            console.error(err);
            setErrorMessage('Hubo un problema al confirmar tu pedido. Por favor, avisa al personal.');
            setStatus('error');
        }
    };


    if (status === 'loading') {
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto animate-bounce" />
                    <p className="text-lg font-semibold mt-4 text-gray-700 dark:text-gray-200">
                        Preparando tu mesa digital...
                    </p>
                </div>
            </div>
        );
    }
    
    if (status === 'error' || status === 'occupied') {
         return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">Pizzería Los Genios</h1>
                    <p className="text-lg text-red-600 dark:text-red-400">{errorMessage}</p>
                </div>
            </div>
        );
    }

    if (status === 'ordered') {
        return (
            <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">¡Pedido enviado!</h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Tu pedido ha sido enviado a la cocina. Si necesitas agregar más productos, por favor avisa a nuestro personal.
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                        ¡Buen provecho!
                    </p>
                </div>
            </div>
        );
    }

    const { products, promotions, categories } = menu;
    const menuItemsByCategory = useMemo(() => {
        const grouped: { [key: string]: (Product | Promotion)[] } = {};
        
        promotions.forEach(promo => {
            if (!grouped['Promociones']) grouped['Promociones'] = [];
            grouped['Promociones'].push(promo);
        });
        
        products.forEach(prod => {
            if (!grouped[prod.category]) grouped[prod.category] = [];
            grouped[prod.category].push(prod);
        });

        return categories
            .map(cat => ({ name: cat.name, items: grouped[cat.name] || [] }))
            .filter(cat => cat.items.length > 0);
    }, [products, promotions, categories]);


    const addItemToOrder = (item: Product | Promotion) => {
        if (!order) return;
        
        const isPromo = 'isActive' in item;
        const existingItemIndex = order.items.findIndex(i => i.itemId === item.id);
        
        let newItems: OrderItem[];

        if(existingItemIndex > -1) {
            newItems = order.items.map((orderItem, index) => 
                index === existingItemIndex 
                ? { ...orderItem, quantity: orderItem.quantity + 1 }
                : orderItem
            );
        } else {
            newItems = [...order.items, {
                itemId: item.id,
                name: item.name,
                quantity: 1,
                price: Number(item.price),
                isPromotion: isPromo,
            }];
        }
        handleUpdateOrder(newItems);
    }

    return (
        <div className="bg-light dark:bg-dark text-dark dark:text-light font-sans antialiased min-h-screen">
            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
                 <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <PizzaIcon className="w-8 h-8 text-primary" />
                      <h1 className="text-2xl font-bold font-display text-dark dark:text-light">Mesa {table?.name}</h1>
                    </div>
                 </div>
            </header>
            
            <main className="container mx-auto px-6 py-8">
                <div className="space-y-12">
                     {menuItemsByCategory.map(({ name, items }) => (
                         <section key={name}>
                             <h2 className="text-3xl font-bold font-display text-dark dark:text-light mb-6 border-b-2 border-primary pb-2">
                                {name}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map(item => (
                                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-semibold pr-2">{item.name}</h3>
                                                <p className="text-lg font-bold text-primary">${Number(item.price).toLocaleString('es-AR')}</p>
                                            </div>
                                            {'description' in item && item.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{item.description}</p>}
                                            {'items' in item && <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{item.items.map(i => `${i.quantity}x ${i.name}`).join(' + ')}</p>}
                                        </div>
                                         <button onClick={() => addItemToOrder(item)} className="mt-auto w-full bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
                                            Agregar
                                        </button>
                                    </div>
                                ))}
                            </div>
                         </section>
                     ))}
                </div>
            </main>
            
            <OrderCart 
                order={order}
                isOpen={isCartOpen}
                setIsOpen={setIsCartOpen}
                onUpdateOrder={handleUpdateOrder}
                onConfirmOrder={handleConfirmOrder}
            />

        </div>
    );
};

export default TableOrderView;