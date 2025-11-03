import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../icons/CloseIcon';
import type { ReservationSettings } from '../../types';

interface ReservationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ReservationSettings) => Promise<void>;
  currentSettings: ReservationSettings;
}

// Helper to generate options for selects
const generateNumericOptions = (start: number, end: number, step: number): number[] => {
  const options = [];
  for (let i = start; i <= end; i += step) {
    options.push(i);
  }
  return options;
};

const ReservationSettingsModal: React.FC<ReservationSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
    }
  }, [isOpen, currentSettings]);

  const handleChange = (field: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await onSave(settings);
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 1500);
    } catch (error) {
        console.error("Failed to save settings:", error);
        setIsSaving(false);
        // Here you could set an error state to show a message to the user
    }
  };
  
  const durationOptions = generateNumericOptions(30, 240, 30); // 30 mins to 4 hours
  const minBookingTimeOptions = [10, ...generateNumericOptions(30, 240, 30)]; // 10 mins, then 30 mins to 4 hours
  const initialBlockTimeOptions = generateNumericOptions(60, 300, 10);
  const extensionBlockTimeOptions = generateNumericOptions(30, 90, 10);
  const modificationLockTimeOptions = generateNumericOptions(30, 1440, 10);
  const slotIntervalOptions = generateNumericOptions(30, 180, 15);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Configuración de Reservas</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
        </header>

        <div className="p-6 space-y-4">
           {showSuccess && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
                    <p className="font-bold">¡Éxito!</p>
                    <p>La configuración se ha guardado correctamente.</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duración de la reserva (minutos)</label>
                    <select id="duration" value={settings.duration} onChange={(e) => handleChange('duration', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {durationOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
                 <div className="space-y-1">
                    <label htmlFor="minBookingTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Antelación mínima hoy (minutos)</label>
                    <select id="minBookingTime" value={settings.minBookingTime} onChange={(e) => handleChange('minBookingTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {minBookingTimeOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="initialBlockTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bloqueo de mesa previo (minutos)</label>
                    <select id="initialBlockTime" value={settings.initialBlockTime} onChange={(e) => handleChange('initialBlockTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {initialBlockTimeOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
                 <div className="space-y-1">
                    <label htmlFor="extensionBlockTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Extensión bloqueo por no-show (minutos)</label>
                    <select id="extensionBlockTime" value={settings.extensionBlockTime} onChange={(e) => handleChange('extensionBlockTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {extensionBlockTimeOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="slotInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Intervalo de turnos (minutos)</label>
                    <select id="slotInterval" value={settings.slotInterval} onChange={(e) => handleChange('slotInterval', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {slotIntervalOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
                 <div className="space-y-1">
                    <label htmlFor="modificationLockTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiempo límite para modificar (minutos)</label>
                    <select id="modificationLockTime" value={settings.modificationLockTime} onChange={(e) => handleChange('modificationLockTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                        {modificationLockTimeOptions.map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 disabled:bg-gray-400">
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReservationSettingsModal;