import React, { useState, useEffect } from 'react';
import { getScheduleFromCache as getSchedule, saveSchedule } from '../../services/scheduleService';
import type { Schedule, TimeSlot } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import ManageExceptionsModal from './ManageExceptionsModal';
import { CloseIcon } from '../icons/CloseIcon';

interface SchedulePanelProps {
  dataTimestamp: number;
}

const SchedulePanel: React.FC<SchedulePanelProps> = ({ dataTimestamp }) => {
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isExceptionsModalOpen, setIsExceptionsModalOpen] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        const loadedSchedule = getSchedule();
        setSchedule(loadedSchedule);
        setIsLoading(false);
    }, [dataTimestamp]);
    
    const handleToggleOpen = (day: string) => {
        if (!schedule) return;
        setSchedule(prev => {
            if (!prev) return null;
            const updatedDay = { ...prev[day], isOpen: !prev[day].isOpen };
            return { ...prev, [day]: updatedDay };
        });
    };
    
    const handleTimeChange = (day: string, slotIndex: number, type: 'open' | 'close', value: string) => {
        if (!schedule) return;
        setSchedule(prev => {
            if (!prev) return null;
            const updatedSlots = [...prev[day].slots];
            updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], [type]: value };
            return { ...prev, [day]: { ...prev[day], slots: updatedSlots }};
        });
    };
    
    const handleAddSlot = (day: string) => {
        if (!schedule || schedule[day].slots.length >= 2) return;
        setSchedule(prev => {
            if (!prev) return null;
            const updatedSlots = [...prev[day].slots, { open: '18:00', close: '23:00' }];
            return { ...prev, [day]: { ...prev[day], slots: updatedSlots }};
        });
    };

    const handleRemoveSlot = (day: string, slotIndex: number) => {
        if (!schedule || schedule[day].slots.length <= 1) return;
        setSchedule(prev => {
            if (!prev) return null;
            const updatedSlots = prev[day].slots.filter((_, index) => index !== slotIndex);
            return { ...prev, [day]: { ...prev[day], slots: updatedSlots }};
        });
    };


    const handleSaveChanges = async () => {
        if (!schedule) return;
        setIsSaving(true);
        setSaveError(null);
        setShowSuccess(false);

        try {
            await saveSchedule(schedule);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            if (error instanceof Error) {
                setSaveError(error.message);
            } else {
                setSaveError('Ocurrió un error inesperado al guardar.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseExceptionsModal = () => {
        setIsExceptionsModalOpen(false);
    };

    const daysOfWeek = [
        { key: 'monday', name: 'Lunes' },
        { key: 'tuesday', name: 'Martes' },
        { key: 'wednesday', name: 'Miércoles' },
        { key: 'thursday', name: 'Jueves' },
        { key: 'friday', name: 'Viernes' },
        { key: 'saturday', name: 'Sábado' },
        { key: 'sunday', name: 'Domingo' },
    ];
    
    if (isLoading || !schedule) {
        return <p className="dark:text-white">Cargando horarios...</p>;
    }

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Horarios de Atención</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExceptionsModalOpen(true)}
                        className="flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <SettingsIcon className="w-5 h-5 mr-2" />
                        Gestionar Excepciones
                    </button>
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="flex items-center justify-center bg-primary text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            {showSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4 animate-fade-in" role="alert">
                    <strong className="font-bold">¡Éxito!</strong>
                    <span className="block sm:inline ml-2">Los horarios se han guardado correctamente en la nube.</span>
                </div>
            )}
             {saveError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 animate-fade-in" role="alert">
                    <strong className="font-bold">Error al guardar:</strong>
                    <span className="block sm:inline ml-2">{saveError}</span>
                    <button onClick={() => setSaveError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 sm:p-6 space-y-6">
                {daysOfWeek.map(({ key, name }) => {
                    const daySchedule = schedule[key];
                    return (
                        <div key={key} className="p-4 border dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                                <div className="font-semibold text-lg text-gray-700 dark:text-gray-200">{name}</div>
                                <div className="flex items-center justify-start mt-2 sm:mt-0">
                                    <label htmlFor={`toggle-${key}`} className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" id={`toggle-${key}`} className="sr-only" checked={daySchedule.isOpen} onChange={() => handleToggleOpen(key)} />
                                            <div className="block w-14 h-8 rounded-full bg-gray-300 dark:bg-gray-600 transition-colors"></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform`}></div>
                                        </div>
                                        <div className="ml-3 text-gray-700 dark:text-gray-300 font-medium">
                                            {daySchedule.isOpen ? 'Abierto' : 'Cerrado'}
                                        </div>
                                    </label>
                                    <style>{`
                                        input:checked ~ .block { background-color: #E53935; } /* primary color */
                                        input:checked ~ .dot { transform: translateX(1.5rem); }
                                    `}</style>
                                </div>
                            </div>

                            <div className={`space-y-4 transition-opacity duration-300 ${daySchedule.isOpen ? 'opacity-100' : 'opacity-50'}`}>
                                {daySchedule.slots.map((slot, index) => (
                                    <div key={index} className="flex flex-col lg:flex-row items-center gap-4">
                                        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 w-full">
                                            <div className="flex items-center w-full sm:w-auto">
                                                <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Abre:</label>
                                                <input 
                                                    type="time" 
                                                    value={slot.open}
                                                    onChange={(e) => handleTimeChange(key, index, 'open', e.target.value)}
                                                    disabled={!daySchedule.isOpen}
                                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:border-primary focus:ring-primary disabled:bg-gray-200 dark:disabled:bg-gray-800"
                                                />
                                            </div>
                                            <div className="flex items-center w-full sm:w-auto">
                                                <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Cierra:</label>
                                                <input 
                                                    type="time" 
                                                    value={slot.close}
                                                    onChange={(e) => handleTimeChange(key, index, 'close', e.target.value)}
                                                    disabled={!daySchedule.isOpen}
                                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:border-primary focus:ring-primary disabled:bg-gray-200 dark:disabled:bg-gray-800"
                                                />
                                            </div>
                                        </div>
                                        {daySchedule.slots.length > 1 && (
                                            <button 
                                                onClick={() => handleRemoveSlot(key, index)} 
                                                className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-300"
                                                disabled={!daySchedule.isOpen}
                                                aria-label="Eliminar horario"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {daySchedule.slots.length < 2 && (
                                    <button
                                        onClick={() => handleAddSlot(key)}
                                        disabled={!daySchedule.isOpen}
                                        className="flex items-center text-sm font-semibold text-primary hover:underline disabled:text-gray-400 disabled:cursor-not-allowed disabled:no-underline"
                                    >
                                        <PlusIcon className="w-4 h-4 mr-1"/>
                                        Agregar horario
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <ManageExceptionsModal
                isOpen={isExceptionsModalOpen}
                onClose={handleCloseExceptionsModal}
            />
        </div>
    );
};

export default SchedulePanel;