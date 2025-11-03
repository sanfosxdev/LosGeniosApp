import React, { useState, useEffect } from 'react';
import { getDbSettings, saveDbSettings, testDbConnection, syncLocalDataToSheet } from '../../services/settingsService';
import { SettingsIcon } from '../icons/SettingsIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { UploadCloudIcon } from '../icons/UploadCloudIcon';

const SettingsPanel: React.FC = () => {
    const [url, setUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [sheetId, setSheetId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [operationResult, setOperationResult] = useState<{ type: 'test' | 'sync'; ok: boolean; message: string } | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

    useEffect(() => {
        const settings = getDbSettings();
        setUrl(settings.url);
        setSecret(settings.secret);
        setSheetId(settings.sheetId);
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        saveDbSettings({ url, secret, sheetId });
        setTimeout(() => {
            setIsSaving(false);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 1000);
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setOperationResult(null);
        saveDbSettings({ url, secret, sheetId }); 
        const result = await testDbConnection();
        setOperationResult({ type: 'test', ...result });
        setIsTesting(false);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setOperationResult(null);
        try {
            await syncLocalDataToSheet();
            setOperationResult({ type: 'sync', ok: true, message: '¡Sincronización completada con éxito! Todos los datos locales han sido enviados a tu Google Sheet.' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            setOperationResult({ type: 'sync', ok: false, message: `Error en la sincronización: ${message}` });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Ajustes</h2>
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-6 border-b dark:border-gray-700 pb-4">
                    <SettingsIcon className="w-8 h-8 text-primary" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Base de Datos (Google Sheets)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Configura la conexión con tu backend de Google Apps Script.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="apps-script-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            URL de la Web App de Apps Script
                        </label>
                        <input
                            id="apps-script-url"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="https://script.google.com/macros/s/..."
                        />
                    </div>
                     <div>
                        <label htmlFor="sheet-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            ID de la Hoja de Cálculo de Google
                        </label>
                        <input
                            id="sheet-id"
                            type="text"
                            value={sheetId}
                            onChange={(e) => setSheetId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ_12345AbCdEfG"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Obtén el ID de la URL de tu hoja: .../spreadsheets/d/<b>[ESTE_ES_EL_ID]</b>/edit...
                        </p>
                    </div>
                    <div>
                        <label htmlFor="secret-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Clave Secreta
                        </label>
                        <input
                            id="secret-key"
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="Tu clave secreta"
                        />
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Esta clave debe coincidir con la variable `SECRET_KEY` en tu archivo `ScriptBD.js`.</p>
                    </div>
                    
                    {operationResult && (
                        <div className={`flex items-start gap-3 p-3 rounded-md ${operationResult.ok ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                            {operationResult.ok ? <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                            <span className="text-sm font-medium">{operationResult.message}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-end items-center gap-3 mt-8 pt-4 border-t dark:border-gray-700">
                     <button
                        onClick={handleSync}
                        disabled={isSyncing || !url || !secret || !sheetId}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                       <UploadCloudIcon className="w-5 h-5 mr-2" />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos Locales a Sheet'}
                    </button>
                    <div className="w-full sm:w-auto flex items-center gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting || !url || !secret || !sheetId}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            {isTesting ? 'Probando...' : 'Probar Conexión'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : (saveStatus === 'success' ? 'Guardado ✓' : 'Guardar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
