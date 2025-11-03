

import React, { useState, useEffect, useMemo } from 'react';
import type { Category, Product } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface AdjustPricesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    targetCategory: string,
    percentage: number,
    rounding: 'none' | 'integer' | '10' | '50' | '100'
  ) => void;
  categories: Category[];
  products: Product[];
}

const AdjustPricesModal: React.FC<AdjustPricesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  categories,
  products,
}) => {
  const [targetCategory, setTargetCategory] = useState('all');
  const [percentage, setPercentage] = useState(10);
  const [rounding, setRounding] = useState<'none' | 'integer' | '10' | '50' | '100'>('10');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setTargetCategory('all');
      setPercentage(10);
      setRounding('10');
      setShowConfirmation(false);
      setError(null);
    }
  }, [isOpen]);

  const productsToAdjust = useMemo(() => {
    if (targetCategory === 'all') {
      return products;
    }
    return products.filter(p => p.category === targetCategory);
  }, [products, targetCategory]);

  const examplePrice = 1000;
  const adjustedExamplePrice = (examplePrice * (1 + percentage / 100)).toFixed(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (productsToAdjust.length === 0) {
        setError('No hay productos en la categoría seleccionada para ajustar.');
        return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmAdjustment = () => {
    onConfirm(targetCategory, percentage, rounding);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Ajustar Precios de Productos</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        
        {!showConfirmation ? (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="targetCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aplicar a</label>
                <select
                  id="targetCategory"
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="all">Todos los productos</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="percentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Porcentaje de ajuste (%)</label>
                <input
                  id="percentage"
                  type="number"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Usa un valor negativo para disminuir precios.</p>
              </div>
              <div>
                <label htmlFor="rounding" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Redondear nuevo precio</label>
                <select
                  id="rounding"
                  value={rounding}
                  onChange={(e) => setRounding(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="none">Sin redondeo (2 decimales)</option>
                  <option value="integer">Al entero más cercano</option>
                  <option value="10">Al múltiplo de 10 más cercano</option>
                  <option value="50">Al múltiplo de 50 más cercano</option>
                  <option value="100">Al múltiplo de 100 más cercano</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-200">Previsualización:</p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Se ajustará el precio de <strong>{productsToAdjust.length}</strong> productos.
                </p>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Ejemplo: un producto de ${examplePrice.toLocaleString('es-AR')} pasará a costar
                  aprox. <strong>${parseFloat(adjustedExamplePrice).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong> (antes de redondear).
                </p>
              </div>
            </div>
            <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
              {error && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{error}</p>}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Continuar
              </button>
            </footer>
          </form>
        ) : (
          <div>
            <div className="p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Confirmar Ajuste</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                    ¿Estás seguro de que quieres {percentage >= 0 ? 'incrementar' : 'disminuir'} los precios de
                    <strong> {targetCategory === 'all' ? 'todos los productos' : `la categoría "${targetCategory}"`}</strong> en un
                    <strong> {Math.abs(percentage)}%</strong>?
                </p>
                 <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Esta acción es irreversible.
                </p>
            </div>
             <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                <button
                    type="button"
                    onClick={() => setShowConfirmation(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    Volver
                </button>
                <button
                    type="button"
                    onClick={handleConfirmAdjustment}
                    className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                    Sí, aplicar ajuste
                </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdjustPricesModal;