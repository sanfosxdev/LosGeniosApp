/**
 *  Webhook Handler for BuilderBot Events & Manual Status Checker
 *
 *  SETUP INSTRUCTIONS:
 *  1. DEPLOY THIS SCRIPT AS A NEW WEB APP.
 *     - In the Apps Script editor: Deploy > New Deployment.
 *     - Type: Web App.
 *     - Execute as: Me.
 *     - Who has access: Anyone.
 *  2. COPY THE WEB APP URL.
 *  3. PROVIDE THIS URL to your bot service (BuilderBot) as the webhook endpoint.
 *  4. TO RUN A MANUAL CHECK: In the Apps Script editor, select the function 'checkBotStatusManually' and click 'Run'.
 */

// --- CONFIGURATION ---
// ID de la hoja de cálculo de Google donde se registrarán los datos.
// Puedes encontrarlo en la URL de tu hoja: .../spreadsheets/d/[ESTE_ES_EL_ID]/edit
const SHEET_ID = "1wBGA_7out-9eSonGZAM-cPt9VOPa5OxQCA3Low_fVUI";

// Project ID del bot de BuilderBot que quieres monitorear.
const PROJECT_ID = "e40701d9-d93a-451f-9d5b-5cb02c237add"; // Reemplaza con tu Project ID

// API Key de BuilderBot v1 para consultar el estado del deploy.
const BUILDERBOT_API_KEY = "bbc-ff129879-89ee-43a5-a28b-640480e3294a";

const WEBHOOK_LOGS_SHEET_NAME = "WhastappAssistant_logs";
const MIS_BOTS_SHEET_NAME = "WhastappAssistant";
const WHATSAPPS_HISTORY_SHEET_NAME = "WhatsappsHistory";

/**
 * Función para verificar manualmente el estado del bot.
 * Se puede ejecutar directamente desde el editor de Apps Script.
 */
function checkBotStatusManually() {
    const projectId = PROJECT_ID;
    const apiKey = BUILDERBOT_API_KEY;
    const sheetId = SHEET_ID;

    if (!projectId || !apiKey || !sheetId) {
        Logger.log("Configuration variables (PROJECT_ID, BUILDERBOT_API_KEY, SHEET_ID) must be set.");
        return;
    }

    const url = `https://app.builderbot.cloud/api/v1/manager/deploys/${projectId}`;
    const options = {
        method: 'get',
        headers: {
            'x-api-builderbot': apiKey
        },
        muteHttpExceptions: true 
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();
        const clientSpreadsheet = SpreadsheetApp.openById(sheetId);
        
        let newStatus = 'inactive';
        let details = `Manual check. Response code: ${responseCode}.`;

        if (responseCode === 200) {
            const data = JSON.parse(responseBody);
            const apiStatus = data.deploy && data.deploy.status;
            details += ` API Status: ${apiStatus}.`;

            if (apiStatus === 'ACTIVE' || apiStatus === 'ONLINE') {
                newStatus = 'active';
            } else if (apiStatus === 'READY_TO_SCAN') {
                newStatus = 'pending_scan';
            } else {
                newStatus = 'inactive';
            }
        } else if (responseCode === 404) {
            newStatus = 'inactive';
            details += ' Bot not found on server (404), considered disconnected.';
        } else {
             newStatus = 'inactive';
             details += ` Unexpected response: ${responseBody}`;
        }
        
        updateBotStatus(clientSpreadsheet, projectId, newStatus, details);
        Logger.log(`Manual status check completed. New status: ${newStatus}. Details: ${details}`);

    } catch (error) {
        Logger.log(`Error during manual status check: ${error.toString()}`);
         try {
            const clientSpreadsheet = SpreadsheetApp.openById(sheetId);
            updateBotStatus(clientSpreadsheet, projectId, 'inactive', `Manual check failed: ${error.toString()}`);
        } catch (e) {
             Logger.log(`Could not log the manual check failure: ${e.toString()}`);
        }
    }
}


/**
 * Verifica si un evento tiene un manejador explícito en la función routeEvent.
 * @param {string} eventName El nombre del evento.
 * @returns {boolean} Verdadero si el evento es manejado.
 */
function isEventHandled(eventName) {
    const handledEvents = [
        'status.ready',
        'status.require_action',
        'status.disconnect',
        'message.incoming',
        'message.calling',
        'message.outgoing'
    ];
    return handledEvents.includes(eventName);
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
    
    // Usamos el projectId configurado al inicio del script.
    const projectId = PROJECT_ID; 

    if (!projectId) {
        Logger.log(`PROJECT_ID no está configurado en el script.`);
        return createJsonResponse({ status: 'error', message: 'PROJECT_ID is not configured in the script.' });
    }

    const clientSpreadsheet = SpreadsheetApp.openById(SHEET_ID);
    
    // Log every incoming event for debugging and history.
    logWebhookEvent(clientSpreadsheet, payload.eventName, projectId, payload.data);
    
    // Route the event to the appropriate handler to update bot status.
    routeEvent(clientSpreadsheet, projectId, payload);

    return createJsonResponse({ status: 'success', message: 'Event processed.' });

  } catch (error) {
    Logger.log("Webhook Error: " + error.toString() + "\nStack: " + error.stack + "\nPayload: " + e.postData.contents);
    // Try to log the error to the sheet even if processing fails
    try {
        const clientSpreadsheet = SpreadsheetApp.openById(SHEET_ID);
        logWebhookEvent(clientSpreadsheet, 'error.parsing', PROJECT_ID, { raw: e.postData.contents, error: error.toString() });
    } catch (loggingError) {
        Logger.log(`Failed to log parsing error to client sheet: ${loggingError.toString()}`);
    }
    
    // Return a 200 OK to the webhook provider to prevent retries.
    return createJsonResponse({ status: 'error', message: 'Error processing event, but it has been logged.' });
  }
}

function routeEvent(clientSpreadsheet, projectId, payload) {
    const eventName = payload.eventName;
    const data = payload.data;

    if (!eventName || !data) {
        Logger.log("Invalid payload structure: missing eventName or data.");
        return;
    }

    switch (eventName) {
        case 'status.ready': // Corresponds to status.online
            updateBotStatus(clientSpreadsheet, projectId, 'active', `Online since ${new Date(data.timestamp).toLocaleString()}`);
            break;
        case 'status.require_action':
            updateBotStatus(clientSpreadsheet, projectId, 'pending_scan', `Requires QR scan as of ${new Date().toLocaleString()}`);
            break;
        case 'status.disconnect':
            updateBotStatus(clientSpreadsheet, projectId, 'inactive', `Disconnected: ${data.reason || 'Unknown reason'}`);
            break;
        case 'message.incoming':
        case 'message.calling':
        case 'message.outgoing':
            logMessageHistory(clientSpreadsheet, eventName, projectId, data);
            Logger.log(`Message event '${eventName}' for projectId ${projectId} processed for history.`);
            break;
        default:
            Logger.log(`Received unhandled event type: ${eventName} for projectId ${projectId}`);
            break;
    }
}


// --- Helper Functions ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function ensureSheetAndHeaders(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e0e0e0');
  } else { // Ensure headers are present even if sheet exists
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e0e0e0');
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const headerSet = new Set(currentHeaders);
      let lastColumn = sheet.getLastColumn();
      headers.forEach(header => {
          if (!headerSet.has(header)) {
              lastColumn++;
              sheet.getRange(1, lastColumn).setValue(header).setFontWeight('bold').setBackground('#e0e0e0');
          }
      });
    }
  }
  return sheet;
}

/**
 * Logs an incoming or outgoing message to the WhatsappsHistory sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} clientSpreadsheet The spreadsheet object of the client.
 * @param {string} eventName The name of the event ('message.incoming' or 'message.outgoing').
 * @param {string} projectId The bot's project ID.
 * @param {object} data The message data payload.
 */
function logMessageHistory(clientSpreadsheet, eventName, projectId, data) {
    try {
        const historySheetHeaders = ['timestamp', 'messageId', 'direction', 'from', 'to', 'body', 'mediaUrl', 'rawPayload'];
        const historySheet = ensureSheetAndHeaders(clientSpreadsheet, WHATSAPPS_HISTORY_SHEET_NAME, historySheetHeaders);

        const messageId = data.id || 'N/A';
        const direction = eventName.replace('message.', ''); // 'incoming' or 'outgoing'
        const from = data.from || 'N/A';
        const to = data.to || 'N/A';
        const body = data.body || '';
        const mediaUrl = (data.media && data.media.url) || data.mediaUrl || '';

        historySheet.appendRow([
            new Date().toISOString(),
            messageId,
            direction,
            from,
            to,
            body.toString().substring(0, 5000), // Allow longer message bodies
            mediaUrl,
            JSON.stringify(data)
        ]);
        Logger.log(`Message '${messageId}' logged successfully to history sheet.`);
    } catch (e) {
        Logger.log(`Failed to write to message history sheet for sheetId ${clientSpreadsheet.getId()}: ${e.toString()}`);
    }
}

/**
 * Logs an event to the specified client's spreadsheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} clientSpreadsheet The spreadsheet object of the client.
 * @param {string} eventName The name of the event.
 * @param {string} projectId The bot's project ID.
 * @param {object} data The event data payload.
 * @param {string} [botStatus] Optional. The new status of the bot to log.
 */
function logWebhookEvent(clientSpreadsheet, eventName, projectId, data, botStatus) {
    try {
        const logSheetHeaders = ['timestamp', 'eventName', 'projectId', 'from', 'details', 'rawPayload', 'unhandledStatus', 'botStatus'];
        const logSheet = ensureSheetAndHeaders(clientSpreadsheet, WEBHOOK_LOGS_SHEET_NAME, logSheetHeaders);
        
        const getNested = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

        const details = data.reason || data.body || data.answer || JSON.stringify(getNested(data, 'payload')) || data.details || '';
        const from = data.from || 'N/A';
        const unhandledStatusValue = !isEventHandled(eventName) ? eventName : '';

        logSheet.appendRow([
            new Date().toISOString(),
            eventName,
            projectId || 'N/A',
            from,
            details.toString().substring(0, 500),
            JSON.stringify(data),
            unhandledStatusValue,
            botStatus || ''
        ]);
        Logger.log(`Webhook event '${eventName}' for projectId ${projectId} logged successfully to client sheet ID ${clientSpreadsheet.getId()}.`);
    } catch (e) {
        Logger.log(`Failed to write to target log sheet for sheetId ${clientSpreadsheet.getId()}: ${e.toString()}`);
    }
}

/**
 * Updates a bot's status and logs the change.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} clientSpreadsheet The spreadsheet object of the client.
 * @param {string} projectId The project ID of the bot to update.
 * @param {string} newStatus The new status to set ('active', 'inactive', 'pending_scan').
 * @param {string} details A description of the status change for logging.
 */
function updateBotStatus(clientSpreadsheet, projectId, newStatus, details) {
    if(!projectId) {
        Logger.log("updateBotStatus called without a projectId.");
        return;
    }

    try {
        const misBotsSheet = clientSpreadsheet.getSheetByName(MIS_BOTS_SHEET_NAME);
        if (!misBotsSheet) {
            Logger.log(`Sheet '${MIS_BOTS_SHEET_NAME}' not found in spreadsheet ID ${clientSpreadsheet.getId()}.`);
            return;
        }

        const botData = misBotsSheet.getDataRange().getValues();
        const botHeaders = botData.length > 0 ? botData[0] : [];
        const botProjectIdCol = botHeaders.indexOf('projectId');
        const botStatusCol = botHeaders.indexOf('status');
        
        if (botProjectIdCol === -1 || botStatusCol === -1) {
             Logger.log(`'projectId' or 'status' column not found in '${MIS_BOTS_SHEET_NAME}' for sheet ID ${clientSpreadsheet.getId()}.`);
             return;
        }

        for (let i = 1; i < botData.length; i++) {
            if (botData[i][botProjectIdCol] === projectId) {
                const physicalRow = i + 1;
                const currentStatus = misBotsSheet.getRange(physicalRow, botStatusCol + 1).getValue();

                // Only update and log if the status has actually changed
                if (currentStatus !== newStatus) {
                  misBotsSheet.getRange(physicalRow, botStatusCol + 1).setValue(newStatus);
                  Logger.log(`Updated status for bot with projectId ${projectId} to '${newStatus}' in sheet ID ${clientSpreadsheet.getId()}. Details: ${details}`);
                  
                  // Log the status change event
                  logWebhookEvent(
                    clientSpreadsheet, 
                    'status.change.logged', 
                    projectId, 
                    { details: details },
                    newStatus
                  );
                }
                return; // Bot found
            }
        }
        
        Logger.log(`Could not find bot with projectId ${projectId} in sheet ID ${clientSpreadsheet.getId()} to update status.`);

    } catch (e) {
        Logger.log(`Error updating bot status in sheet ID ${clientSpreadsheet.getId()}: ${e.toString()}`);
    }
}