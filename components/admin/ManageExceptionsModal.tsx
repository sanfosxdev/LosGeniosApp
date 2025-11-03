import React, { useState, useEffect } from 'react';
import type { ScheduleException, TimeSlot } from '../../types';
import { ExceptionType } from '../../types';
// Fix: Use getScheduleExceptionsFromCache instead of getScheduleExceptions
import { getScheduleExceptionsFromCache as getScheduleExceptions, addScheduleException, updateScheduleException, deleteScheduleException } from '../../services/scheduleExceptionService';
import { CloseIcon } from '../icons/CloseIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { PlusIcon } from '../icons/PlusIcon';
import DeleteExceptionConfirmationModal from './DeleteExceptionConfirmationModal';

interface ManageExceptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageExceptionsModal: React.FC<ManageExceptionsModalProps> = ({ isOpen, onClose }) => {
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [editingException, setEditingException] = useState<ScheduleException | null>(null);
  const [exceptionToDelete, setExceptionToDelete] = useState<ScheduleException | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<ExceptionType>(ExceptionType.CLOSED);
  const [slots, setSlots] = useState<TimeSlot[]>([{ open: '10:00', close: '22:00' }]);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = !!editingException;
  const today = new Date().toISOString().split('T')[0];

  const fetchExceptions = () => {
    setExceptions(getScheduleExceptions().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
  };

  useEffect(() => {
    if (isOpen) {
      fetchExceptions();
    }
  }, [isOpen]);

  const handleEditClick = (exception: ScheduleException) => {
    setEditingException(exception);
    setName(exception.name);
    setStartDate(exception.startDate);
    setEndDate(exception.endDate);
    setType(exception.type);
    setSlots(exception.slots || [{ open: '10:00', close: '22:00' }]);
    setFormError(null);
  };

  const clearForm = () => {
    setEditingException(null);
    setName('');
    setStartDate('');
    setEndDate('');
    setType(ExceptionType.CLOSED);
    setSlots([{ open: '10:00', close: '22:00' }]);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !startDate || !endDate) {
      setFormError('Por favor complete todos los campos.');
      return;
    }

    if (!isEditing && startDate < today) {
        setFormError('No se puede crear una excepción con una fecha de inicio en el pasado.');
        return;
    }
    
    const exceptionData: Omit<ScheduleException, 'id'> = {
        name,
        startDate,
        endDate,
        type,
        slots: type === ExceptionType.SPECIAL_HOURS ? slots : undefined,
    };

    if (isEditing && editingException) {
      await updateScheduleException({ ...exceptionData, id: editingException.id });
    } else {
      await addScheduleException(exceptionData);
    }
    fetchExceptions();
    clearForm();
  };
  
  const handleDeleteClick = (exception: ScheduleException) => {
    setExceptionToDelete(exception);
  };

  const handleConfirmDelete = async () => {
    if (exceptionToDelete) {
      await deleteScheduleException(exceptionToDelete.id);
      fetchExceptions();
      setExceptionToDelete(null);
    }
  };
  
  const handleTimeChange = (slotIndex: number, timeType: 'open' | 'close', value: string) => {
    const updatedSlots = [...slots];
    updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], [timeType]: value };
    setSlots(updatedSlots);
  };
  
  const handleAddSlot = () => {
    if (slots.length < 2) {
      setSlots([...slots, { open: '18:00', close: '23:00' }]);
    }
  };
  
  const handleRemoveSlot = (slotIndex: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, index) => index !== slotIndex));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
          <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Gestionar Excepciones de Horario</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
              <CloseIcon className="w-6 h-6" />
            </button>
          </header>
          
          <div className="flex-grow overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{isEditing ? 'Editar Excepción' : 'Nueva Excepción'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Desde</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={isEditing ? undefined : today} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hasta</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || today} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                    </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
                  <select value={type} onChange={e => setType(e.target.value as ExceptionType)} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required>
                    {Object.values(ExceptionType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {type === ExceptionType.SPECIAL_HOURS && (
                    <div className="space-y-2 p-3 border dark:border-gray-600 rounded-md animate-fade-in">
                         {slots.map((slot, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="time" value={slot.open} onChange={e => handleTimeChange(index, 'open', e.target.value)} className="w-full text-sm p-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
                                <span>-</span>
                                <input type="time" value={slot.close} onChange={e => handleTimeChange(index, 'close', e.target.value)} className="w-full text-sm p-1 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
                                {slots.length > 1 && <button type="button" onClick={() => handleRemoveSlot(index)} className="p-1 text-red-500"><TrashIcon className="w-4 h-4" /></button>}
                            </div>
                         ))}
                         {slots.length < 2 && <button type="button" onClick={handleAddSlot} className="text-sm text-primary flex items-center"><PlusIcon className="w-4 h-4 mr-1"/>Agregar horario</button>}
                    </div>
                )}
                {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" className="flex-grow px-4 py-2 text-white bg-primary rounded-md">{isEditing ? 'Guardar Cambios' : 'Agregar'}</button>
                  {isEditing && <button type="button" onClick={clearForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>}
                </div>
              </form>
            </div>
            
            <div className="md:w-2/3 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Excepciones Programadas</h3>
              <div className="space-y-2">
                {exceptions.length > 0 ? exceptions.map(ex => (
                    <div key={ex.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{ex.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(ex.startDate + 'T00:00:00').toLocaleDateString('es-AR')} - {new Date(ex.endDate + 'T00:00:00').toLocaleDateString('es-AR')}
                          </p>
                          <div className="mt-1">
                             <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ex.type === ExceptionType.CLOSED ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{ex.type}</span>
                             {ex.type === ExceptionType.SPECIAL_HOURS && ex.slots && (
                                <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">{ex.slots.map(s => `${s.open}-${s.close}`).join(', ')}</span>
                             )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleEditClick(ex)} className="p-2 text-blue-600"><EditIcon className="w-5 h-5"/></button>
                            <button onClick={() => handleDeleteClick(ex)} className="p-2 text-red-600"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-gray-500 dark:text-gray-400">No hay excepciones programadas.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DeleteExceptionConfirmationModal isOpen={!!exceptionToDelete} onClose={() => setExceptionToDelete(null)} onConfirm={handleConfirmDelete} exceptionName={exceptionToDelete?.name || ''} />
    </>
  );
};

export default ManageExceptionsModal;