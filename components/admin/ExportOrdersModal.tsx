

import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../icons/CloseIcon';

interface ExportOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
}

const ExportOrdersModal: React.FC<ExportOrdersModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (new Date(startDate) > new Date(endDate)) {
        setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
        return;
    }
    try {
        onConfirm(startDate, endDate);
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('Ocurrió un error inesperado al exportar.');
        }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Exportar Pedidos a CSV</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Selecciona el rango de fechas para exportar los pedidos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  required
                />
              </div>
            </div>
             {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Exportar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ExportOrdersModal;