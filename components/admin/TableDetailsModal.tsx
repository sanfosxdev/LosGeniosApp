import React from 'react';
import type { EnrichedTable } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface TableDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: EnrichedTable | null;
}

const TableDetailsModal: React.FC<TableDetailsModalProps> = ({ isOpen, onClose, table }) => {
  if (!isOpen || !table) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Detalles de la Mesa: {table.name}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Capacidad</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{table.capacity} personas</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permite Reservas</p>
                    <p className={`font-semibold ${table.allowsReservations ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {table.allowsReservations ? 'Sí' : 'No'}
                    </p>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Estado Actual</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{table.status}</p>
                    {table.details ? (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                           <p><strong>Tipo:</strong> {table.details.type === 'order' ? 'Pedido' : 'Reserva'}</p>
                           <p><strong>Cliente:</strong> {table.details.customerName}</p>
                           {table.details.time && <p><strong>Hora:</strong> {table.details.time}</p>}
                           <p>
                             <strong>ID:</strong> #{table.details.id.split('-')[1]}
                           </p>
                           {table.overrideStatus === 'Bloqueada' && <p className="mt-2 text-xs italic">Manualmente bloqueada por un administrador.</p>}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">La mesa está disponible para clientes.</p>
                    )}
                </div>
            </div>

        </div>

        <footer className="flex justify-end items-center p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TableDetailsModal;
