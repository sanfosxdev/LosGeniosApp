import apiService from './apiService';
import { getLocalDataForSync } from './sliceBotMetricsService';

const SETTINGS_STORAGE_KEY = 'pizzeria-db-settings';

export interface DbSettings {
  url: string;
  secret: string;
  sheetId: string;
}

const defaultSettings: DbSettings = {
  url: 'https://script.google.com/macros/s/AKfycbzC3k0w0WvHkmnYLv6jY5INs7bFozcNQMAAspCRZ5AD2tA8Ie9Zo3LOWx4LoRppAL85nA/exec',
  sheetId: '1wBGA_7out-9eSonGZAM-cPt9VOPa5OxQCA3Low_fVUI',
  secret: 'LosGeniosApp',
};

export const saveDbSettings = (settings: DbSettings): void => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const getDbSettings = (): DbSettings => {
  const settingsJson = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (settingsJson) {
    try {
      const stored = JSON.parse(settingsJson);
      // Ensure all fields are present, falling back to defaults if empty
      return {
        url: stored.url || defaultSettings.url,
        secret: stored.secret || defaultSettings.secret,
        sheetId: stored.sheetId || defaultSettings.sheetId,
      };
    } catch(e) {
      console.error("Error parsing DB settings from localStorage", e);
      return defaultSettings;
    }
  }
  return defaultSettings;
};


export const testDbConnection = async (): Promise<{ ok: boolean; message: string }> => {
  const settings = getDbSettings();
  if (!settings || !settings.url || !settings.secret || !settings.sheetId) {
    return { ok: false, message: 'Configuración incompleta. Guarda la URL, la clave secreta y el ID de la hoja primero.' };
  }

  try {
    const url = new URL(settings.url);
    url.searchParams.append('action', 'testConnection');
    url.searchParams.append('secret', settings.secret);
    url.searchParams.append('sheetId', settings.sheetId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow' 
    });
    
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch(e) {
        console.error("La respuesta del backend no es un JSON válido:", responseText);
        return { ok: false, message: 'Respuesta inválida del servidor. Revisa el script y la URL de despliegue.'};
    }

    if (response.ok && data.status === 'success') {
      return { ok: true, message: data.message || 'Conexión exitosa.' };
    }
    
    return { ok: false, message: data.message || 'Error en la respuesta del servidor.' };
    
  } catch (error) {
    console.error("Error en la prueba de conexión:", error);
    let errorMessage = 'No se pudo conectar al servidor. Revisa la URL y tu conexión a internet.';
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage += ' Es posible que haya un problema de CORS; asegúrate de que tu script esté desplegado para "Cualquier usuario".';
    }
    return { ok: false, message: errorMessage };
  }
};

const getLocalDataByKey = (key: string) => {
    const dataJson = localStorage.getItem(key);
    return dataJson ? JSON.parse(dataJson) : [];
}

export const syncLocalDataToSheet = async (): Promise<any> => {
    const sliceBotData = getLocalDataForSync();
    const reservationSettingsJson = localStorage.getItem('pizzeria-reservation-settings');
    const reservationSettings = reservationSettingsJson ? [JSON.parse(reservationSettingsJson)] : [];


    const dataToSync = {
        products: getLocalDataByKey('pizzeria-products'),
        categories: getLocalDataByKey('pizzeria-categories'),
        promotions: getLocalDataByKey('pizzeria-promotions'),
        orders: getLocalDataByKey('pizzeria-orders'),
        reservations: getLocalDataByKey('pizzeria-reservations'),
        tables: getLocalDataByKey('pizzeria-tables'),
        customers: getLocalDataByKey('pizzeria-customers'),
        customerCategories: getLocalDataByKey('pizzeria-customer-categories'),
        scheduleExceptions: getLocalDataByKey('pizzeria-schedule-exceptions'),
        reservationSettings: reservationSettings,
        // Special handling for schedule as it's an object, not an array
        schedule: localStorage.getItem('pizzeria-schedule'), 
        ...sliceBotData,
    };

    return apiService.post('syncAllData', dataToSync);
};