
import React from 'react';
import { CloseIcon } from '../icons/CloseIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface DeleteReservationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reservationInfo: string;
}

const DeleteReservationConfirmationModal: React.FC<DeleteReservationConfirmationModalProps> = ({ isOpen, onClose, onConfirm, reservationInfo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">Confirmar Eliminación</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <p className="mt-4 text-gray-600">
                ¿Estás seguro de que quieres eliminar la reserva de 
                <strong className="block mt-1">"{reservationInfo}"</strong>?
            </p>
            <p className="mt-2 text-sm text-gray-500">
                Esta acción no se puede deshacer.
            </p>
        </div>
        <footer className="flex justify-end items-center p-5 border-t bg-gray-50 rounded-b-lg space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">Eliminar</button>
        </footer>
      </div>
    </div>
  );
};

export default DeleteReservationConfirmationModal;
