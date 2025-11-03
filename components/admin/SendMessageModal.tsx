
import React, { useState, useEffect } from 'react';
import type { Customer, CustomerCategory } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (phones: string[], content: string, mediaUrl?: string) => void;
  customers: Customer[];
  categories: CustomerCategory[];
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({ isOpen, onClose, onSend, customers, categories }) => {
    const [targetType, setTargetType] = useState<'specific' | 'all' | 'category'>('specific');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [targetCount, setTargetCount] = useState(0);

    useEffect(() => {
        if (isOpen && customers.length > 0) {
            setSelectedCustomerId(customers[0].id);
            setSelectedCategoryIds([]);
            setContent('');
            setMediaUrl('');
            setTargetType('specific');
        }
    }, [isOpen, customers]);

    useEffect(() => {
        if (!isOpen) return;

        let phones = new Set<string>();

        if (targetType === 'specific') {
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer?.phone) phones.add(customer.phone);
        } else if (targetType === 'all') {
            customers.forEach(c => {
                if(c.phone) phones.add(c.phone)
            });
        } else if (targetType === 'category') {
            const categoryIdSet = new Set(selectedCategoryIds);
            customers.forEach(c => {
                if (c.phone && categoryIdSet.has(c.categoryId)) {
                    phones.add(c.phone);
                }
            });
        }
        setTargetCount(phones.size);
    }, [isOpen, targetType, selectedCustomerId, selectedCategoryIds, customers]);

    const handleSend = () => {
        let phones = new Set<string>();
        if (targetType === 'specific') {
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer?.phone) phones.add(customer.phone);
        } else if (targetType === 'all') {
             customers.forEach(c => {
                if(c.phone) phones.add(c.phone)
            });
        } else if (targetType === 'category') {
            const categoryIdSet = new Set(selectedCategoryIds);
            customers.forEach(c => {
                if (c.phone && categoryIdSet.has(c.categoryId)) {
                    phones.add(c.phone);
                }
            });
        }
        onSend(Array.from(phones), content, mediaUrl);
    };

    if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Enviar Mensaje de WhatsApp</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 space-y-4 overflow-y-auto">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destinatarios</label>
                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center"><input type="radio" name="target" value="specific" checked={targetType === 'specific'} onChange={() => setTargetType('specific')} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300"/>Un cliente específico</label>
                    <label className="flex items-center"><input type="radio" name="target" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300"/>Todos los clientes</label>
                    <label className="flex items-center"><input type="radio" name="target" value="category" checked={targetType === 'category'} onChange={() => setTargetType('category')} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300"/>Clientes por categoría</label>
                </div>
            </div>

            {targetType === 'specific' && (
                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
            )}

            {targetType === 'category' && (
                <select
                    multiple
                    value={selectedCategoryIds}
                    onChange={(e) => setSelectedCategoryIds(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))}
                    className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}

            <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
                <textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Puedes usar *texto en negrita* y _texto en cursiva_.</p>
            </div>
             <div>
                <label htmlFor="mediaUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de Imagen (Opcional)</label>
                <input id="mediaUrl" type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.png" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
            </div>
        </div>
        <footer className="flex justify-between items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            {targetCount} destinatario(s)
          </span>
          <div className="space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={targetCount === 0 || !content.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {targetCount > 5 ? `Enviar a ${targetCount}` : 'Enviar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SendMessageModal;