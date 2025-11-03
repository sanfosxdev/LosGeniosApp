import { getDbSettings } from './settingsService';

const apiService = {
  async get(sheetName: string): Promise<any[]> {
    const settings = getDbSettings();
    if (!settings.url || !settings.secret || !settings.sheetId) {
        throw new Error('La base de datos no está configurada. Por favor, ve a Ajustes.');
    }

    const url = new URL(settings.url);
    url.searchParams.append('action', 'getAllData');
    url.searchParams.append('sheetName', sheetName);
    url.searchParams.append('secret', settings.secret);
    url.searchParams.append('sheetId', settings.sheetId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });
    
    const text = await response.text();
    if (!response.ok) {
        try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.message || `Error al obtener datos de ${sheetName}`);
        } catch (e) {
            throw new Error(`Error en el servidor al obtener ${sheetName}. Respuesta no válida.`);
        }
    }
    
    return JSON.parse(text);
  },

  async post(action: string, payload: Record<string, any>): Promise<any> {
    const settings = getDbSettings();
     if (!settings.url || !settings.secret || !settings.sheetId) {
        throw new Error('La base de datos no está configurada. Por favor, ve a Ajustes.');
    }

    const body = {
      action,
      secret: settings.secret,
      sheetId: settings.sheetId,
      payload: payload 
    };
    
    const response = await fetch(settings.url, {
      method: 'POST',
      body: JSON.stringify(body),
      // Apps Script doPost requiere que el content-type sea text/plain
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      // No usar `mode: 'no-cors'` ya que necesitamos leer la respuesta
    });

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch(e) {
        console.error("Respuesta no JSON del backend:", text);
        throw new Error("El backend devolvió una respuesta inesperada.");
    }

    if (result.status === 'error') {
        throw new Error(result.message);
    }

    return result.data;
  }
};

export default apiService;
