

import React, { useState, useEffect } from 'react';
import type { Table } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface AddEditTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (table: Omit<Table, 'id'> & { id?: string }) => void;
  tableToEdit?: Table | null;
}

const AddEditTableModal: React.FC<AddEditTableModalProps> = ({ isOpen, onClose, onSave, tableToEdit }) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(2);
  const [allowsReservations, setAllowsReservations] = useState(true);
  const isEditing = !!tableToEdit;

  useEffect(() => {
    if (isOpen) {
      if (tableToEdit) {
        setName(tableToEdit.name);
        setCapacity(tableToEdit.capacity);
        setAllowsReservations(tableToEdit.allowsReservations);
      } else {
        setName('');
        setCapacity(2);
        setAllowsReservations(true);
      }
    }
  }, [isOpen, tableToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || capacity < 1) {
      alert('Por favor, ingresa un nombre válido y una capacidad mayor a 0.');
      return;
    }
    onSave({
      id: tableToEdit?.id,
      name,
      capacity,
      allowsReservations,
      overrideStatus: tableToEdit?.overrideStatus ?? null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar Mesa' : 'Agregar Nueva Mesa'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
              <input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min="1" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required />
            </div>
            <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={allowsReservations}
                        onChange={(e) => setAllowsReservations(e.target.checked)}
                        className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Permite Reservas</span>
                </label>
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t bg-gray-50 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700">{isEditing ? 'Guardar Cambios' : 'Agregar Mesa'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddEditTableModal;