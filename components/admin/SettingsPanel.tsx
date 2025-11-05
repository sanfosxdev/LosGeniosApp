import React from 'react';
import { clearLocalStorage } from '../../services/settingsService';
import { SettingsIcon } from '../icons/SettingsIcon';
import { TrashIcon } from '../icons/TrashIcon';

const SettingsPanel: React.FC = () => {
    
    const firebaseProjectId = import.meta.env.VITE_FIREBASE_APP_ID;

    const handleClearLocalData = () => {
        if (window.confirm('¿Estás seguro de que quieres borrar todos los datos locales? Esto cerrará tu sesión en el panel y forzará una recarga completa de los datos desde Firebase. No se borrarán datos de la base de datos.')) {
            clearLocalStorage();
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Ajustes</h2>
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-6 border-b dark:border-gray-700 pb-4">
                    <SettingsIcon className="w-8 h-8 text-primary" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Base de Datos (Firebase)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">La aplicación ahora está conectada a Firebase Firestore.</p>
                    </div>
                </div>
                 <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Los datos se sincronizan en tiempo real. No se requiere configuración manual aquí.
                    </p>
                    {firebaseProjectId && (
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                            <p className="text-sm text-gray-600 dark:text-gray-400">ID del Proyecto de Firebase:</p>
                            <p className="font-mono font-semibold text-primary">{firebaseProjectId}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                     <TrashIcon className="w-8 h-8 text-red-500" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Mantenimiento</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Acciones para desarrollo y solución de problemas.</p>
                    </div>
                </div>
                 <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Limpiar caché local</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                            Esta acción borrará todos los datos almacenados en tu navegador (pedidos, productos, etc.) y los volverá a cargar desde Firebase. Es útil si encuentras inconsistencias en los datos. No afectará la base de datos.
                        </p>
                         <button
                            onClick={handleClearLocalData}
                            className="px-4 py-2 border border-red-500 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                        >
                            Limpiar Datos Locales
                        </button>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
