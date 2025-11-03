import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Order, Table, Product, Category, Promotion, OrderItem } from '../types';
import { OrderType, CreatedBy, OrderStatus, PaymentMethod } from '../types';
import { getEnrichedTableById, getTablesFromCache, fetchAndCacheTables } from '../services/tableService';
import { getOrdersFromCache, saveOrder, updateOrder, updateOrderStatus, fetchAndCacheOrders } from '../services/orderService';
import { getReservationsFromCache, fetchAndCacheReservations } from '../services/reservationService';
import { fetchAndCacheProducts } from '../services/productService';
import { fetchAndCacheCategories } from '../services/categoryService';
import { fetchAndCachePromotions } from '../services/promotionService';

import { PizzaIcon } from './icons/PizzaIcon';
import OrderCart from './table_order/OrderCart';

type ViewStatus = 'loading' | 'welcome' | 'ready' | 'occupied' | 'error' | 'ordered';

const TableOrderView: React.FC<{ tableId: string }> = ({ tableId }) => {
    const [viewStatus, setViewStatus] = useState<ViewStatus>('loading');
    const [table, setTable] = useState<Table | null>(null);
    const [order, setOrder] = useState<Order | null>(null);
    const [menu, setMenu] = useState<{ products: Product[], promotions: Promotion[], categories: Category[] }>({ products: [], promotions: [], categories: [] });
    const [errorMessage, setErrorMessage] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            try {
                // Step 1: Fetch all data to ensure caches are fresh
                const [products, categories, promotions] = await Promise.all([
                    fetchAndCacheProducts(),
                    fetchAndCacheCategories(),
                    fetchAndCachePromotions(),
                    fetchAndCacheTables(),
                    fetchAndCacheOrders(),
                    fetchAndCacheReservations()
                ]);
                setMenu({ products, promotions: promotions.filter(p => p.isActive), categories });

                // Step 2: Find the table
                const tableInfo = getTablesFromCache().find(t => t.id === tableId);
                if (!tableInfo) {
                    throw new Error(`Mesa con ID "${tableId}" no encontrada.`);
                }
                setTable(tableInfo);

                // Step 3: Check for an existing order session
                const sessionOrderKey = `pizzeria-table-order-${tableId}`;
                const sessionOrderId = sessionStorage.getItem(sessionOrderKey);
                
                if (sessionOrderId) {
                    const existingOrder = getOrdersFromCache().find(o => o.id === sessionOrderId);
                    if (existingOrder && existingOrder.status === OrderStatus.PENDING) {
                        setOrder(existingOrder);
                        setViewStatus('ready');
                        return; // Initialization complete
                    } else {
                        sessionStorage.removeItem(sessionOrderKey);
                    }
                }
                
                // Step 4: If no session, check table status
                const enrichedTable = getEnrichedTableById(tableId);
                
                if (!enrichedTable) {
                    throw new Error('No se pudieron obtener los detalles completos de la mesa.');
                }

                if (enrichedTable.status === 'Libre') {
                    setViewStatus('welcome');
                } else {
                    setErrorMessage(`Esta mesa está actualmente ${enrichedTable.status.toLowerCase()}. Por favor, consulta con un miembro del personal.`);
                    setViewStatus('occupied');
                }

            } catch (err) {
                console.error("Error during table order initialization:", err);
                const message = err instanceof Error ? err.message : 'Ocurrió un error al cargar la información.';
                setErrorMessage(message);
                setViewStatus('error');
            }
        };

        initialize();
    }, [tableId]);
    
    const handleStartOrder = useCallback(async () => {
        if (!table) return;
        setViewStatus('loading');
        try {
            const newOrder = await saveOrder({
                customer: { name: `Mesa ${table.name}` },
                items: [],
                total: 0,
                type: OrderType.DINE_IN,
                tableIds: [table.id],
                guests: 1, // Default guests, can be adjusted later if needed
                createdBy: CreatedBy.WEB_ASSISTANT,
                paymentMethod: PaymentMethod.CASH,
            });
            const sessionOrderKey = `pizzeria-table-order-${table.id}`;
            sessionStorage.setItem(sessionOrderKey, newOrder.id);
            setOrder(newOrder);
            setViewStatus('ready');
        } catch (err) {
            console.error("Error creating order:", err);
            setErrorMessage("No se pudo iniciar el pedido. Por favor, intenta de nuevo.");
            setViewStatus('error');
        }
    }, [table]);

    const handleUpdateOrder = (newItems: OrderItem[]) => {
        if (!order) return;
        const newTotal = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const updatedOrder = { ...order, items: newItems, total: newTotal };
        setOrder(updatedOrder);
        updateOrder(updatedOrder).catch(err => console.error("Failed to sync cart changes:", err));
    };

    const handleConfirmOrder = async () => {
        if (!order || order.items.length === 0) return;
        try {
            setViewStatus('loading');
            
            // Atomically update the entire order object.
            // We are manually adding the status history entry that updateOrderStatus would have added.
            const confirmedOrder = {
                ...order, // Contains latest items and total
                status: OrderStatus.CONFIRMED,
                statusHistory: [ ...order.statusHistory, { status: OrderStatus.CONFIRMED, startedAt: new Date().toISOString() } ]
            };

            // updateOrder will merge this with the cached version and save everything.
            await updateOrder(confirmedOrder);
            
            const sessionOrderKey = `pizzeria-table-order-${tableId}`;
            sessionStorage.removeItem(sessionOrderKey);
            setViewStatus('ordered');
        } catch (err) {
            console.error(err);
            setErrorMessage('Hubo un problema al confirmar tu pedido. Por favor, avisa al personal.');
            setViewStatus('error');
        }
    };
    
    const menuItemsByCategory = useMemo(() => {
        const grouped: { [key: string]: (Product | Promotion)[] } = {};
        
        menu.promotions.forEach(promo => {
            if (!grouped['Promociones']) grouped['Promociones'] = [];
            grouped['Promociones'].push(promo);
        });
        
        menu.products.forEach(prod => {
            if (!grouped[prod.category]) grouped[prod.category] = [];
            grouped[prod.category].push(prod);
        });

        const categoryOrder = ['Promociones', ...menu.categories.map(c => c.name).filter(name => name !== 'Promociones')];

        return categoryOrder
            .map(name => ({ name, items: grouped[name] || [] }))
            .filter(cat => cat.items.length > 0);

    }, [menu.products, menu.promotions, menu.categories]);


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


    if (viewStatus === 'loading') {
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
    
    if (viewStatus === 'error' || viewStatus === 'occupied') {
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
    
    if (viewStatus === 'welcome') {
        return (
             <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md animate-fade-in">
                    <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-dark dark:text-light mb-2">¡Bienvenido a la Mesa {table?.name}!</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Estás a punto de empezar tu pedido. Presiona el botón para ver nuestro menú.
                    </p>
                     <button
                        onClick={handleStartOrder}
                        className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-transform duration-300 ease-in-out transform hover:scale-105"
                    >
                        Hacer un Pedido
                    </button>
                </div>
            </div>
        );
    }

    if (viewStatus === 'ordered') {
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
                                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col justify-between transition-transform hover:scale-105">
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