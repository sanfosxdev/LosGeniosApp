// ID de la Hoja de Cálculo. Configúralo aquí una sola vez.
const SHEET_ID = "1wBGA_7out-9eSonGZAM-cPt9VOPa5OxQCA3Low_fVUI";

// Nombres de las hojas
const CUSTOMER_SHEET_NAME = 'Customers';
const ORDERS_SHEET_NAME = 'Orders';
const RESERVATIONS_SHEET_NAME = 'Reservations';
const TABLES_SHEET_NAME = 'Tables';
const SCHEDULE_SHEET_NAME = 'Schedule';
const PRODUCTS_SHEET_NAME = 'Products';
const PROMOTIONS_SHEET_NAME = 'Promotions';


// --- Controlador Principal ---

/**
 * Maneja las solicitudes POST para interactuar con la hoja de cálculo.
 * Es compatible con `Content-Type: application/json` y `Content-Type: multipart/form-data`.
 */
function doPost(e) {
  try {
    let requestBody;
    
    // Detecta si la petición es form-data/x-www-form-urlencoded o JSON.
    if (e.parameter && e.parameter.action) {
      requestBody = e.parameter;
    } else {
      try {
        requestBody = JSON.parse(e.postData.contents);
      } catch (parseError) {
        const errorMessage = 'Error al procesar la solicitud: El cuerpo de la petición (body) no es un JSON válido. ' +
          'Asegúrate de estar enviando un string JSON correcto (usando JSON.stringify). ' +
          'Error original: ' + parseError.message + '. Recibido: ' + e.postData.contents.substring(0, 200);
        throw new Error(errorMessage);
      }
    }

    if (!requestBody || !requestBody.action) {
      throw new Error("Solicitud inválida. La propiedad 'action' es obligatoria en el cuerpo de la petición.");
    }
    
    const { action } = requestBody;

    if (!SHEET_ID) {
      throw new Error("El SHEET_ID no está configurado en el script.");
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let responseData;

    switch (action) {
      case 'getCustomerAndBusinessStatus':
        responseData = getCustomerAndBusinessStatus(ss, requestBody);
        break;
      
      case 'findCustomer':
        responseData = findCustomer(ss.getSheetByName(CUSTOMER_SHEET_NAME), requestBody);
        break;
      case 'saveCustomer':
        responseData = saveCustomer(ss.getSheetByName(CUSTOMER_SHEET_NAME), requestBody);
        break;
      case 'editCustomer':
        responseData = updateRowById(ss.getSheetByName(CUSTOMER_SHEET_NAME), requestBody);
        break;
      
      case 'getActiveOrders':
        responseData = getOrders(ss.getSheetByName(ORDERS_SHEET_NAME));
        break;
      case 'createOrder':
        responseData = createOrder(ss.getSheetByName(ORDERS_SHEET_NAME), requestBody);
        break;
      case 'updateOrder':
        responseData = updateRowById(ss.getSheetByName(ORDERS_SHEET_NAME), requestBody);
        break;
      
      case 'getActiveReservations':
        responseData = getReservations(ss.getSheetByName(RESERVATIONS_SHEET_NAME));
        break;
      case 'createReservation':
        responseData = createReservation(ss.getSheetByName(RESERVATIONS_SHEET_NAME), requestBody);
        break;
      case 'updateReservation':
        responseData = updateRowById(ss.getSheetByName(RESERVATIONS_SHEET_NAME), requestBody);
        break;

      case 'getTables':
        responseData = getTables(ss.getSheetByName(TABLES_SHEET_NAME));
        break;

      case 'getSchedule':
        responseData = getSchedule(ss.getSheetByName(SCHEDULE_SHEET_NAME));
        break;

      default:
        throw new Error(`Acción POST inválida o no mapeada: ${action}`);
    }

    return createSuccessResponse(responseData);

  } catch (error) {
    return createErrorResponse(error);
  }
}


// --- Helpers ---

/**
 * Función centralizada para crear una respuesta JSON estandarizada.
 */
function createJsonResponse(isSuccess, content) {
  const finalPayload = {
    status: isSuccess ? 'success' : 'error',
  };

  if (isSuccess) {
    finalPayload.data = content;
  } else {
    finalPayload.message = content;
  }

  return ContentService.createTextOutput(JSON.stringify(finalPayload))
    .setMimeType(ContentService.MimeType.JSON);
}

function createSuccessResponse(data) {
  return createJsonResponse(true, data);
}

function createErrorResponse(error) {
  Logger.log(error.stack);
  return createJsonResponse(false, error.message);
}


/**
 * Obtiene los encabezados y los datos de una hoja.
 */
function getSheetDataWithHeaders(sheet) {
  if (!sheet) return { headers: [], data: [] };
  if (sheet.getLastRow() < 1) return { headers: [], data: [] };
  
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift() || []; 
  return { headers, data: allData };
}

/**
 * Convierte una fila (array) en un objeto usando los encabezados.
 */
function convertRowToObject(row, headers) {
  const obj = {};
  headers.forEach((header, i) => {
    let value = row[i];
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') value = true;
        else if (value.toLowerCase() === 'false') value = false;
        else if (!isNaN(value) && value.trim() !== '' && !isNaN(parseFloat(value))) {
          if (String(parseFloat(value)) === value) value = parseFloat(value);
        } else if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
          try { value = JSON.parse(value); } catch (e) { /* Mantener como texto */ }
        }
      }
    obj[header] = value;
  });
  return obj;
}

/**
 * Convierte un array de objetos en un objeto, usando la propiedad 'id' como clave.
 */
function arrayToObjectById(array) {
  if (!Array.isArray(array)) {
    return {};
  }
  return array.reduce((obj, item) => {
    if (item && item.id) {
      obj[item.id] = item;
    }
    return obj;
  }, {});
}


// --- Lógica de Acciones ---

/**
 * Busca un cliente y devuelve el estado completo del negocio.
 */
function getCustomerAndBusinessStatus(ss, payload) {
  const { phone } = payload;
  if (!phone) {
    throw new Error("El 'phone' es obligatorio para la acción 'getCustomerAndBusinessStatus'.");
  }

  const customerSheet = ss.getSheetByName(CUSTOMER_SHEET_NAME);
  const scheduleSheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  const ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  const reservationsSheet = ss.getSheetByName(RESERVATIONS_SHEET_NAME);
  const tablesSheet = ss.getSheetByName(TABLES_SHEET_NAME);
  const productsSheet = ss.getSheetByName(PRODUCTS_SHEET_NAME);
  const promotionsSheet = ss.getSheetByName(PROMOTIONS_SHEET_NAME);

  return {
    customer: findCustomer(customerSheet, { query: phone, findBy: 'phone' }),
    schedule: getSchedule(scheduleSheet),
    activeOrders: arrayToObjectById(getOrders(ordersSheet)),
    activeReservations: arrayToObjectById(getReservations(reservationsSheet)),
    tables: arrayToObjectById(getTables(tablesSheet)),
    products: arrayToObjectById(getProducts(productsSheet)),
    activePromotions: arrayToObjectById(getPromotions(promotionsSheet))
  };
}


// CLIENTES
function findCustomer(sheet, payload) {
  if (!sheet) return null;
  const { query, findBy } = payload;
  if (!query || !findBy) {
    throw new Error("El 'query' y 'findBy' son obligatorios para buscar un cliente.");
  }
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const findByIndex = headers.indexOf(findBy);
  if (findByIndex === -1) {
    throw new Error(`La columna '${findBy}' no existe en la hoja de clientes.`);
  }
  const normalizedQuery = String(query).trim().toLowerCase();
  const customerRow = data.find(row => String(row[findByIndex]).trim().toLowerCase() === normalizedQuery);
  return customerRow ? convertRowToObject(customerRow, headers) : null;
}

function saveCustomer(sheet, payload) {
  if (!sheet) throw new Error(`Hoja '${CUSTOMER_SHEET_NAME}' no encontrada.`);
  const { phone, email } = payload;
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const phoneIndex = headers.indexOf('phone');
  const emailIndex = headers.indexOf('email');
  
  if (phoneIndex > -1 && emailIndex > -1) {
    const existingCustomer = data.find(row => 
      (phone && String(row[phoneIndex]).trim() === String(phone).trim()) ||
      (email && String(row[emailIndex]).trim().toLowerCase() === String(email).trim().toLowerCase())
    );
    if (existingCustomer) {
      throw new Error(`Ya existe un cliente con el teléfono o email proporcionado.`);
    }
  }

  const newCustomer = {
    ...payload,
    id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    categoryId: payload.categoryId || 'CUSTCAT-default-new'
  };

  if (headers.length === 0) {
    const newHeaders = Object.keys(newCustomer);
    sheet.appendRow(newHeaders);
    headers.push(...newHeaders);
  }

  const newRow = headers.map(header => {
    const value = newCustomer[header];
    return (typeof value === 'object' && value !== null) ? JSON.stringify(value) : (value === undefined || value === null ? '' : value);
  });
  sheet.appendRow(newRow);
  return newCustomer;
}

// PEDIDOS
function getOrders(sheet) {
  if (!sheet) return [];
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const statusIndex = headers.indexOf('status');
  if (statusIndex === -1) throw new Error("La hoja de Pedidos no tiene columna 'status'.");
  const finishedStatuses = ['Completado (Retirado)', 'Completado (Entregado)', 'Completado (En Mesa)', 'Cancelado'];
  return data
    .filter(row => !finishedStatuses.includes(row[statusIndex]))
    .map(row => convertRowToObject(row, headers));
}

function createOrder(sheet, payload) {
  if (!sheet) throw new Error(`Hoja '${ORDERS_SHEET_NAME}' no encontrada.`);
  let { headers } = getSheetDataWithHeaders(sheet);
  if (headers.length === 0) {
    const newHeaders = ['id', 'customer', 'items', 'total', 'status', 'type', 'createdAt', 'statusHistory', 'finishedAt', 'tableIds', 'guests', 'paymentMethod', 'isPaid', 'paymentProofUrl', 'reservationId', 'createdBy'];
    sheet.appendRow(newHeaders);
    headers = newHeaders;
  }
  const now = new Date().toISOString();
  const newOrder = {
    ...payload,
    id: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: 'Pendiente',
    createdAt: now,
    statusHistory: [{ status: 'Pendiente', startedAt: now }],
    finishedAt: null,
    isPaid: false,
  };
  const newRow = headers.map(header => {
    const value = newOrder[header];
    return (typeof value === 'object' && value !== null) ? JSON.stringify(value) : (value === undefined || value === null ? '' : value);
  });
  sheet.appendRow(newRow);
  return newOrder;
}

// RESERVAS
function getReservations(sheet) {
  if (!sheet) return [];
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const statusIndex = headers.indexOf('status');
  if (statusIndex === -1) throw new Error("La hoja de Reservas no tiene columna 'status'.");
  return data
    .filter(row => row[statusIndex] === 'Pendiente' || row[statusIndex] === 'Confirmada')
    .map(row => convertRowToObject(row, headers));
}

function createReservation(sheet, payload) {
  if (!sheet) throw new Error(`Hoja '${RESERVATIONS_SHEET_NAME}' no encontrada.`);
  let { headers } = getSheetDataWithHeaders(sheet);
  if (headers.length === 0) {
    const newHeaders = ['id', 'customerName', 'customerPhone', 'guests', 'reservationTime', 'tableIds', 'status', 'statusHistory', 'finishedAt', 'cancellationReason', 'notes', 'createdAt', 'orderId', 'createdBy'];
    sheet.appendRow(newHeaders);
    headers = newHeaders;
  }
  const now = new Date().toISOString();
  const newReservation = {
    ...payload,
    id: `RES-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: 'Pendiente',
    createdAt: now,
    statusHistory: [{ status: 'Pendiente', startedAt: now }],
    finishedAt: null,
  };
  const newRow = headers.map(header => {
    const value = newReservation[header];
    return (typeof value === 'object' && value !== null) ? JSON.stringify(value) : (value === undefined || value === null ? '' : value);
  });
  sheet.appendRow(newRow);
  return newReservation;
}

// LECTURAS GENERALES
function getProducts(sheet) {
  if (!sheet) return [];
  const { headers, data } = getSheetDataWithHeaders(sheet);
  return data.map(row => convertRowToObject(row, headers));
}

function getPromotions(sheet) {
  if (!sheet) return [];
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const isActiveIndex = headers.indexOf('isActive');
  
  if (isActiveIndex === -1) {
    Logger.log("Advertencia: La hoja '" + PROMOTIONS_SHEET_NAME + "' no tiene la columna 'isActive'. Se devolverán todas las promociones.");
    return data.map(row => convertRowToObject(row, headers));
  }

  return data
    .filter(row => row[isActiveIndex] === true || String(row[isActiveIndex]).toLowerCase() === 'true')
    .map(row => convertRowToObject(row, headers));
}

function getTables(sheet) {
  if (!sheet) return [];
  const { headers, data } = getSheetDataWithHeaders(sheet);
  return data.map(row => convertRowToObject(row, headers));
}

function getSchedule(sheet) {
  if (!sheet) return {};
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const schedule = {};
  data.forEach(row => {
    const dayObject = convertRowToObject(row, headers);
    if (dayObject.day) {
      schedule[dayObject.day] = {
        isOpen: dayObject.isOpen,
        slots: Array.isArray(dayObject.slots) ? dayObject.slots : []
      };
    }
  });
  return schedule;
}

// GENÉRICO
function updateRowById(sheet, payload) {
  if (!sheet) throw new Error(`La hoja proporcionada no es válida.`);
  const { id, updates } = payload;
  if (!id || !updates) {
    throw new Error("El 'id' y 'updates' son obligatorios para editar.");
  }
  const { headers, data } = getSheetDataWithHeaders(sheet);
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) {
    throw new Error("La columna 'id' no existe en la hoja.");
  }
  const rowIndexInData = data.findIndex(row => String(row[idIndex]) === String(id));
  if (rowIndexInData === -1) {
    throw new Error(`No se encontró un item con el ID: ${id}`);
  }
  const sheetRowIndex = rowIndexInData + 2;
  const originalRow = data[rowIndexInData];
  const updatedRowData = convertRowToObject(originalRow, headers);
  
  for (const key in updates) {
      if (headers.includes(key)) {
          updatedRowData[key] = updates[key];
      }
  }

  const newRowValues = headers.map(header => {
    let value = updatedRowData[header];
    return (typeof value === 'object' && value !== null) ? JSON.stringify(value) : (value === undefined || value === null ? '' : value);
  });
  sheet.getRange(sheetRowIndex, 1, 1, headers.length).setValues([newRowValues]);
  return updatedRowData;
}