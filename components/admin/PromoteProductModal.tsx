import React, { useState, useEffect } from 'react';
import type { Product } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { MailIcon } from '../icons/MailIcon';

interface PromoteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

const PromoteProductModal: React.FC<PromoteProductModalProps> = ({ isOpen, onClose, product }) => {
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (product) {
            const priceFormatted = `$${Number(product.price).toLocaleString('es-AR')}`;
            const promoText = `¡No te pierdas esta promo en Pizzería Los Genios! 🍕\n\n*${product.name}* - ${priceFormatted}\n${product.description ? `\n${product.description}\n` : ''}\n¡Haz tu pedido ahora!`;
            setMessage(promoText);
        }
    }, [product]);

    if (!isOpen || !product) return null;

    const handleWhatsAppShare = () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleEmailShare = () => {
        const subject = `¡Promoción especial: ${product.name}!`;
        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.location.href = url;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
                <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Promocionar: {product.name}</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="promo-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje de Promoción</label>
                        <textarea
                            id="promo-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>
                <footer className="flex flex-col sm:flex-row justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-y-2 sm:space-y-0 sm:space-x-3">
                    <button
                        onClick={handleWhatsAppShare}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                        <WhatsAppIcon className="w-5 h-5 mr-2" />
                        Enviar por WhatsApp
                    </button>
                    <button
                        onClick={handleEmailShare}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <MailIcon className="w-5 h-5 mr-2" />
                        Enviar por Email
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PromoteProductModal;
