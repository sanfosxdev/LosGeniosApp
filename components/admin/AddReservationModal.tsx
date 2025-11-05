import React, { useState, useEffect } from 'react';
import type { Reservation, Customer } from '../../types';
import { ReservationStatus, CreatedBy } from '../../types';
import { getCustomersFromCache } from '../../services/customerService';
import { getAvailability, findAvailableTables } from '../../services/reservationService';
import { getTablesFromCache } from '../../services/tableService';
import { CloseIcon } from '../icons/CloseIcon';

interface AddReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: Omit<Reservation, 'id' | 'createdAt'> & { id?: string }) => void;
  reservationToEdit: Reservation | null;
}

const AddReservationModal: React.FC<AddReservationModalProps> = ({ isOpen, onClose, onSave, reservationToEdit }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ReservationStatus>(ReservationStatus.CONFIRMED);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const isEditing = !!reservationToEdit;

  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [minDate, setMinDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [submissionError, setSubmissionError] = useState<string | null>(null);


  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setMinDate(today);
      setCustomers(getCustomersFromCache());
      setSubmissionError(null);
      if (reservationToEdit) {
        const customer = getCustomersFromCache().find(c => c.name === reservationToEdit.customerName && c.phone === reservationToEdit.customerPhone);
        setSelectedCustomerId(customer?.id || '');
        setCustomerName(reservationToEdit.customerName);
        setCustomerPhone(reservationToEdit.customerPhone || '');
        setGuests(reservationToEdit.guests);
        const d = new Date(reservationToEdit.reservationTime);
        setSelectedDate(d.toISOString().split('T')[0]);
        setSelectedTime(d.toTimeString().slice(0, 5));
        setNotes(reservationToEdit.notes || '');
        setStatus(reservationToEdit.status);
      } else {
        // Reset form
        setSelectedCustomerId('');
        setCustomerName('');
        setCustomerPhone('');
        setGuests(1);
        setSelectedDate('');
        setSelectedTime('');
        setAvailableSlots([]);
        setNotes('');
        setStatus(ReservationStatus.CONFIRMED);
      }
    }
  }, [isOpen, reservationToEdit]);

  useEffect(() => {
    if (selectedDate && guests > 0) {
        setIsLoadingSlots(true);
        setSelectedTime('');
        const timer = setTimeout(() => {
            const dateObj = new Date(selectedDate + 'T00:00:00');
            const allTables = getTablesFromCache();
            const slots = getAvailability(allTables, dateObj, guests);
            setAvailableSlots(slots);
            setIsLoadingSlots(false);
        }, 50);
        return () => clearTimeout(timer);
    } else {
        setAvailableSlots([]);
    }
  }, [selectedDate, guests, isOpen]);
  
  const handleCustomerSelect = (customerId: string) => {
      setSelectedCustomerId(customerId);
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
          setCustomerName(customer.name);
          setCustomerPhone(customer.phone || '');
      } else {
          setCustomerName('');
          setCustomerPhone('');
      }
  };

  const handleManualCustomerInput = (field: 'name' | 'phone', value: string) => {
    if (field === 'name') setCustomerName(value);
    if (field === 'phone') setCustomerPhone(value);
    if (selectedCustomerId) {
      setSelectedCustomerId('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    if (!customerName || !selectedDate || !selectedTime) {
      setSubmissionError('Por favor complete el nombre, la fecha y el turno.');
      return;
    }
    
    const finalReservationTime = new Date(`${selectedDate}T${selectedTime}`);
    const allTables = getTablesFromCache();
    const availableTableIds = findAvailableTables(allTables, finalReservationTime, guests, reservationToEdit?.id);

    if (!availableTableIds) {
        setSubmissionError('Este turno ya no está disponible. Por favor, seleccione otro.');
        const dateObj = new Date(selectedDate + 'T00:00:00');
        setAvailableSlots(getAvailability(allTables, dateObj, guests));
        setSelectedTime('');
        return;
    }

    const reservationData: Omit<Reservation, 'id' | 'createdAt'> & { id?: string } = {
        id: reservationToEdit?.id,
        customerName,
        customerPhone,
        guests,
        reservationTime: finalReservationTime.toISOString(),
        tableIds: availableTableIds,
        notes,
        statusHistory: reservationToEdit?.statusHistory ?? [],
        finishedAt: reservationToEdit?.finishedAt,
        cancellationReason: reservationToEdit?.cancellationReason,
        orderId: reservationToEdit?.orderId,
        createdBy: reservationToEdit?.createdBy ?? CreatedBy.ADMIN,
        status: isEditing ? status : ReservationStatus.PENDING,
    };

    onSave(reservationData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Reserva' : 'Agregar Nueva Reserva'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar Cliente Existente</label>
                <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                    <option value="">-- Nuevo Cliente --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={customerName} onChange={e => handleManualCustomerInput('name', e.target.value)} placeholder="Nombre del Cliente" required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                <input type="tel" value={customerPhone} onChange={e => handleManualCustomerInput('phone', e.target.value)} placeholder="Teléfono" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={minDate} required className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comensales</label>
                    <input type="number" value={guests} onChange={e => setGuests(Number(e.target.value))} min="1" required className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                </div>
            </div>
            {selectedDate && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Turnos Disponibles</label>
                    {isLoadingSlots ? (
                         <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md mt-1">Calculando disponibilidad...</div>
                    ) : availableSlots.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2 p-2 border dark:border-gray-600 rounded-md">
                            {availableSlots.map(time => (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setSelectedTime(time)}
                                    className={`py-2 px-1 text-sm rounded-md transition-colors font-semibold ${selectedTime === time ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md mt-1">No hay turnos disponibles para esta fecha o cantidad de comensales.</div>
                    )}
                </div>
            )}
             {isEditing && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                    <select value={status} onChange={e => setStatus(e.target.value as ReservationStatus)} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                       {Object.values(ReservationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas (Opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
            </div>
             <footer className="flex justify-end items-center pt-4 mt-4 border-t dark:border-gray-700">
                {submissionError && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{submissionError}</p>}
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700">{isEditing ? 'Guardar Cambios' : 'Guardar Reserva'}</button>
            </footer>
        </form>
      </div>
    </div>
  );
};

export default AddReservationModal;
