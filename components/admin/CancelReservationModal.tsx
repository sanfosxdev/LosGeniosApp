import React, { useState } from 'react';
import { ReservationCancellationReason } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { Spinner } from './Spinner';

interface CancelReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: ReservationCancellationReason) => void;
  isSaving?: boolean;
}

const CancelReservationModal: React.FC<CancelReservationModalProps> = ({ isOpen, onClose, onConfirm, isSaving }) => {
  const [reason, setReason] = useState<ReservationCancellationReason>(ReservationCancellationReason.USER);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cancelar Reserva</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Por favor, selecciona un motivo para la cancelación:
          </label>
          <div className="space-y-2 text-gray-800 dark:text-gray-300">
            <label className="flex items-center">
              <input
                type="radio"
                name="cancelReason"
                value={ReservationCancellationReason.USER}
                checked={reason === ReservationCancellationReason.USER}
                onChange={() => setReason(ReservationCancellationReason.USER)}
                className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"
              />
              {ReservationCancellationReason.USER}
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="cancelReason"
                value={ReservationCancellationReason.ADMIN}
                checked={reason === ReservationCancellationReason.ADMIN}
                onChange={() => setReason(ReservationCancellationReason.ADMIN)}
                className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"
              />
              {ReservationCancellationReason.ADMIN}
            </label>
          </div>
        </div>
        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Volver</button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            disabled={isSaving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 min-w-[180px] flex justify-center items-center disabled:opacity-50"
          >
            {isSaving ? <Spinner /> : 'Confirmar Cancelación'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CancelReservationModal;