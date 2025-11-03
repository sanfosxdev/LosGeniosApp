import React from 'react';
import type { Reservation, Table, Order } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { ClockIcon } from '../icons/ClockIcon';

interface ReservationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  tables: Table[];
  orders: Order[];
}

const formatDuration = (milliseconds: number): string => {
    if (milliseconds < 0) milliseconds = 0;
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
};

const calculateDuration = (start: string, end: string): string => {
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    return formatDuration(durationMs);
};

const ReservationDetailsModal: React.FC<ReservationDetailsModalProps> = ({ isOpen, onClose, reservation, tables, orders }) => {
  if (!isOpen || !reservation) return null;

  const getTableNames = (tableIds?: string[]) => {
    if (!tableIds || tableIds.length === 0) return 'N/A';
    return tableIds.map(id => tables.find(t => t.id === id)?.name || 'Desconocida').join(', ');
  };
  
  const associatedOrder = orders.find(o => o.id === reservation.orderId);

  const statusDurations = reservation.statusHistory.map((history, index) => {
    const start = history.startedAt;
    const end = index < reservation.statusHistory.length - 1
        ? reservation.statusHistory[index + 1].startedAt
        : (reservation.finishedAt || new Date().toISOString());
    const duration = calculateDuration(start, end);
    return { ...history, duration };
  });

  const totalDuration = reservation.finishedAt ? calculateDuration(reservation.createdAt, reservation.finishedAt) : 'En curso';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Detalles de la Reserva #{reservation.id.split('-')[1]}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-6 space-y-6 text-gray-800 dark:text-gray-200">
          {/* General Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Estado Actual</p>
                <p className="font-semibold">{reservation.status}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Comensales</p>
                <p className="font-semibold text-primary text-lg">{reservation.guests}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Origen</p>
                <p className="font-semibold">{reservation.createdBy}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(reservation.createdAt).toLocaleString('es-AR')}</p>
            </div>
             <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Duración Total</p>
                <p className="font-semibold">{totalDuration}</p>
            </div>
          </div>
          
          <hr className="dark:border-gray-700"/>

          {/* Customer & Reservation Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Cliente</h3>
                <p><strong>Nombre:</strong> {reservation.customerName}</p>
                <p><strong>Teléfono:</strong> {reservation.customerPhone || 'N/A'}</p>
            </div>
             <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Reserva</h3>
                <p><strong>Fecha y Hora:</strong> {new Date(reservation.reservationTime).toLocaleString('es-AR')}</p>
                <p><strong>Mesa(s):</strong> {getTableNames(reservation.tableIds)}</p>
                {reservation.notes && <p className="text-sm mt-1"><strong>Notas:</strong> {reservation.notes}</p>}
            </div>
          </div>
          
          {associatedOrder && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-400 dark:border-blue-500">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Pedido Asociado</h3>
                <p><strong>ID Pedido:</strong> #{associatedOrder.id.split('-')[1]}</p>
                <p><strong>Estado del Pedido:</strong> {associatedOrder.status}</p>
                <p><strong>Total Pedido:</strong> ${associatedOrder.total.toLocaleString('es-AR')}</p>
            </div>
          )}

          {/* Status History */}
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Historial de Estados</h3>
            <div className="relative border-l-2 border-primary/20 ml-3">
              {statusDurations.map((history, index) => (
                <div key={index} className="mb-6 ml-6 relative">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary/20 rounded-full -left-9 ring-4 ring-white dark:ring-gray-800">
                    <ClockIcon className="w-3 h-3 text-primary" />
                  </span>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                    <p className="font-semibold">{history.status as string}</p>
                    <time className="block text-xs text-gray-500 dark:text-gray-400">{new Date(history.startedAt).toLocaleString('es-AR')}</time>
                    <p className="text-sm font-medium text-primary mt-1">Duración: {history.duration}</p>
                  </div>
                </div>
              ))}
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

export default ReservationDetailsModal;