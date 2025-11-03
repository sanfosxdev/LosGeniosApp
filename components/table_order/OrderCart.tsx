import React from 'react';
import type { Order, OrderItem } from '../../types';
import { ShoppingCartIcon } from '../icons/ShoppingCartIcon';
import { CloseIcon } from '../icons/CloseIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface OrderCartProps {
    order: Order | null;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onUpdateOrder: (items: OrderItem[]) => void;
    onConfirmOrder: () => void;
}

const OrderCart: React.FC<OrderCartProps> = ({ order, isOpen, setIsOpen, onUpdateOrder, onConfirmOrder }) => {
    
    const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (!order) return;
        let newItems: OrderItem[];
        if (newQuantity <= 0) {
            newItems = order.items.filter(i => i.itemId !== itemId);
        } else {
            newItems = order.items.map(i => i.itemId === itemId ? { ...i, quantity: newQuantity } : i);
        }
        onUpdateOrder(newItems);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-secondary text-dark w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary dark:focus:ring-offset-dark z-50"
                aria-label="Ver pedido"
            >
                <ShoppingCartIcon className="w-8 h-8" />
                {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                        {itemCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 animate-fade-in">
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col transform animate-slide-in-up">
                <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold font-display text-dark dark:text-light">Tu Pedido</h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {order?.items.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">Tu pedido está vacío.</p>
                    ) : (
                        order?.items.map(item => (
                            <div key={item.itemId} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-semibold text-dark dark:text-light">{item.name}</p>
                                    <p className="text-sm text-primary font-semibold">${item.price.toLocaleString('es-AR')}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleQuantityChange(item.itemId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 font-bold">-</button>
                                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                    <button onClick={() => handleQuantityChange(item.itemId, item.quantity + 1)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 font-bold">+</button>
                                </div>
                                <p className="w-20 text-right font-bold text-dark dark:text-light">${(item.price * item.quantity).toLocaleString('es-AR')}</p>
                            </div>
                        ))
                    )}
                </div>
                 <footer className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">Total:</span>
                        <span className="text-2xl font-bold text-primary">${order?.total.toLocaleString('es-AR')}</span>
                    </div>
                    <button 
                        onClick={onConfirmOrder}
                        disabled={!order || order.items.length === 0}
                        className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Confirmar Pedido
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default OrderCart;
