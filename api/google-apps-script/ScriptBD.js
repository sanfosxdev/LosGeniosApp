// Clave secreta para autenticación. 
// ¡IMPORTANTE! Cambia este valor por una contraseña fuerte y única.
// Este mismo valor deberás ponerlo en el panel de administración.
const SECRET_KEY = "LosGeniosApp"; 

// --- Controladores Principales ---

/**
 * Maneja las solicitudes GET. Se usa para probar la conexión y obtener datos.
 */
function doGet(e) {
  try {
    const { secret, action, sheetId, sheetName } = e.parameter;
    authenticate({ secret });
    
    if (!sheetId) {
      throw new Error("El 'sheetId' es obligatorio para todas las solicitudes.");
    }

    let data;

    switch (action) {
      case 'testConnection':
        const ss = SpreadsheetApp.openById(sheetId);
        if (!ss) {
          throw new Error(`No se pudo abrir la hoja de cálculo con el ID: ${sheetId}. Verifica el ID y los permisos.`);
        }
        data = { status: 'success', message: `Conexión exitosa. Acceso correcto a la hoja: "${ss.getName()}"` };
        break;
      case 'getAllData':
        if (!sheetName) throw new Error("El 'sheetName' es obligatorio para 'getAllData'.");
        data = getAllDataFromSheet(sheetId, sheetName);
        break;
      default:
        throw new Error(`Acción GET inválida: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * Maneja las solicitudes POST. Se usa para crear, actualizar, eliminar y sincronizar datos.
 */
function doPost(e) {
  try {
    const requestBody = JSON.parse(e.postData.contents);
    const { secret, action, sheetId, payload } = requestBody;
    
    authenticate({ secret });

    if (!sheetId) {
      throw new Error("El 'sheetId' es obligatorio para todas las solicitudes.");
    }
    
    let responseData;
    const ss = SpreadsheetApp.openById(sheetId);

    switch (action) {
      case 'syncAllData':
        responseData = syncAllData(ss, payload);
        break;
      case 'syncDataType':
        responseData = syncSheet(ss, payload.sheetName, payload.items, payload.headers);
        break;
      case 'addData':
        responseData = addRow(ss, payload.sheetName, payload.item);
        break;
      case 'updateData':
        responseData = updateRow(ss, payload.sheetName, payload.item);
        break;
      case 'deleteData':
        responseData = deleteRow(ss, payload.sheetName, payload.itemId);
        break;
      case 'saveSchedule':
        responseData = handleSaveSchedule(ss, payload);
        break;
      default:
        throw new Error(`Acción POST inválida: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: responseData }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return createErrorResponse(error);
  }
}

// --- Lógica de Horarios ---

/**
 * Transforma y guarda el objeto de horarios en la hoja 'Schedule'.
 */
function handleSaveSchedule(spreadsheet, scheduleObject) {
    const sheetName = 'Schedule';
    const headers = ['day', 'isOpen', 'slots'];
    
    if (typeof scheduleObject !== 'object' || scheduleObject === null) {
        throw new Error("El payload para 'saveSchedule' debe ser un objeto de horarios válido.");
    }
    
    const scheduleArray = Object.keys(scheduleObject).map(day => {
        const dayData = scheduleObject[day];
        return {
            day: day,
            isOpen: dayData.isOpen,
            slots: JSON.stringify(dayData.slots || [])
        };
    });

    return syncSheet(spreadsheet, sheetName, scheduleArray, headers);
}


// --- Autenticación y Helpers ---

/**
 * Verifica que la clave secreta enviada coincida con la del script.
 */
function authenticate(params) {
  if (params.secret !== SECRET_KEY) {
    throw new Error('Autenticación fallida: Clave secreta inválida.');
  }
}

/**
 * Crea una respuesta de error estandarizada.
 */
function createErrorResponse(error) {
  Logger.log(error.stack);
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Obtiene una hoja por su nombre, o la crea si no existe.
 */
function getOrCreateSheet(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

/**
 * Convierte los datos de una hoja en un array de objetos JSON.
 */
function sheetToJSON(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      let value = row[i];
      // Intenta convertir a los tipos de datos correctos
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') {
          value = true;
        } else if (value.toLowerCase() === 'false') {
          value = false;
        } else if (!isNaN(value) && value.trim() !== '' && !isNaN(parseFloat(value))) {
          // Asegúrate de que no sea un número de teléfono largo o ID.
          // Solo convierte si es claramente un número (entero o flotante).
          if (String(parseFloat(value)) === value) {
             value = parseFloat(value);
          }
        } else if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
          try {
            value = JSON.parse(value);
          } catch (e) { /* No es un JSON válido, se mantiene como texto */ }
        }
      }
      obj[header] = value;
    });
    return obj;
  });
}


// --- Lógica de Datos ---

/**
 * Obtiene todos los datos de una hoja específica.
 */
function getAllDataFromSheet(sheetId, sheetName) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  return sheetToJSON(sheet);
}

/**
 * Agrega una nueva fila de datos a una hoja.
 */
function addRow(ss, sheetName, item) {
  const sheet = getOrCreateSheet(ss, sheetName);
  
  if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(item));
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    let value = item[header];
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value === undefined || value === null ? '' : value;
  });
  sheet.appendRow(newRow);
  return item;
}

/**
 * Actualiza una fila existente en una hoja, basándose en el ID.
 */
function updateRow(ss, sheetName, item) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada.`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`La hoja "${sheetName}" debe tener una columna 'id'.`);

  const rowIndex = data.findIndex(row => row[idIndex] == item.id) + 2;
  if (rowIndex < 2) throw new Error(`Ítem con id "${item.id}" no encontrado en "${sheetName}".`);
  
  const newRow = headers.map(header => {
    let value = item[header];
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value === undefined || value === null ? '' : value;
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
  return item;
}

/**
 * Elimina una fila de una hoja, basándose en el ID.
 */
function deleteRow(ss, sheetName, itemId) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada.`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`La hoja "${sheetName}" debe tener una columna 'id'.`);

  const rowIndex = data.findIndex(row => row[idIndex] == itemId) + 2;
  if (rowIndex < 2) throw new Error(`Ítem con id "${itemId}" no encontrado en "${sheetName}".`);
  
  sheet.deleteRow(rowIndex);
  return { id: itemId, status: 'deleted' };
}


/**
 * Sincroniza todos los datos enviados desde el frontend a sus respectivas hojas.
 */
function syncAllData(ss, data) {
  if (!ss) throw new Error(`No se pudo abrir la hoja de cálculo.`);
  
  const syncResults = {};
  const dataMap = {
    Products: { data: data.products, headers: ['id', 'category', 'name', 'description', 'price', 'imageUrl'] },
    Orders: { data: data.orders, headers: ['id', 'customer', 'items', 'total', 'status', 'type', 'createdAt', 'statusHistory', 'finishedAt', 'tableIds', 'guests', 'paymentMethod', 'isPaid', 'paymentProofUrl', 'reservationId', 'createdBy'] },
    Categories: { data: data.categories, headers: ['id', 'name', 'imageUrl', 'color'] },
    CustomerCategories: { data: data.customerCategories, headers: ['id', 'name', 'color'] },
    Customers: { data: data.customers, headers: ['id', 'name', 'phone', 'email', 'address', 'createdAt', 'categoryId'] },
    Promotions: { data: data.promotions, headers: ['id', 'name', 'items', 'price', 'isActive', 'createdAt', 'imageUrl'] },
    Reservations: { data: data.reservations, headers: ['id', 'customerName', 'customerPhone', 'guests', 'reservationTime', 'tableIds', 'status', 'statusHistory', 'finishedAt', 'cancellationReason', 'notes', 'createdAt', 'orderId', 'createdBy'] },
    ReservationSettings: { data: data.reservationSettings, headers: ['duration', 'minBookingTime', 'initialBlockTime', 'extensionBlockTime', 'modificationLockTime', 'slotInterval'] },
    Tables: { data: data.tables, headers: ['id', 'name', 'capacity', 'allowsReservations', 'overrideStatus'] },
    SliceBotMetrics: { data: data.sliceBotMetrics, headers: ['distinctCustomers', 'totalMessages', 'totalTokensUsed', 'ordersMade', 'reservationsMade'] },
    ChatHistory: { data: data.chatHistory, headers: ['id', 'startTime', 'messages', 'outcome', 'tokensUsed', 'lastActivity'] },
    ScheduleExceptions: { data: data.scheduleExceptions, headers: ['id', 'name', 'startDate', 'endDate', 'type', 'slots'] }
  };

  // Manejo especial para el Horario (Schedule)
  if (data.schedule) {
    const scheduleObject = JSON.parse(data.schedule); // Viene como string desde el local storage
    const scheduleArray = Object.keys(scheduleObject).map(day => {
        const dayData = scheduleObject[day];
        return {
            day: day,
            isOpen: dayData.isOpen,
            slots: JSON.stringify(dayData.slots || [])
        };
    });
    syncResults['Schedule'] = syncSheet(ss, 'Schedule', scheduleArray, ['day', 'isOpen', 'slots']);
  }

  for (const sheetName in dataMap) {
    if (dataMap[sheetName].data) {
      syncResults[sheetName] = syncSheet(ss, sheetName, dataMap[sheetName].data, dataMap[sheetName].headers);
    }
  }
  
  return syncResults;
}


/**
 * Sincroniza un array de datos con una hoja específica. Borra la hoja y reescribe todo.
 */
function syncSheet(spreadsheet, sheetName, dataArray, headers) {
  if (!Array.isArray(dataArray)) {
    return { status: 'skipped', message: `Los datos para ${sheetName} no son un array.` };
  }

  const sheet = getOrCreateSheet(spreadsheet, sheetName);
  sheet.clear(); // Limpia la hoja antes de sincronizar

  if (!headers || headers.length === 0) {
      if (dataArray.length > 0) {
          headers = Object.keys(dataArray[0]);
      } else {
          sheet.appendRow(["No hay datos para mostrar."]);
          return { status: 'success', written: 0, message: `No hay datos ni encabezados para ${sheetName}.` };
      }
  }

  if (dataArray.length === 0) {
    sheet.appendRow(headers); // Escribe los encabezados aunque no haya datos
    return { status: 'success', written: 0 };
  }

  // Prepara los datos para ser escritos en la hoja
  const rows = [headers];
  dataArray.forEach(item => {
    const row = headers.map(header => {
      let value = item[header];
      if (value === null || value === undefined) return '';
      // Si el valor ya es un string que parece JSON (como en el caso de 'slots'), no lo re-stringifiques.
      if (typeof value === 'object') {
          return JSON.stringify(value);
      }
      return value;
    });
    rows.push(row);
  });

  // Escribe todos los datos de una sola vez para mayor eficiencia
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  return { status: 'success', written: dataArray.length };
}