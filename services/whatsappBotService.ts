// These values should be in environment variables
import apiService from './apiService';
const projectId = 'e40701d9-d93a-451f-9d5b-5cb02c237add';
const builderBotApiKey = 'bbc-ff129879-89ee-43a5-a28b-640480e3294a';
const builderBotV2ApiKey = 'bb-e25d1057-de9a-4cc0-b103-4bcbc2873820';

const DEPLOY_URL = 'https://app.builderbot.cloud/api/v1/manager/deploys';
const MESSAGES_URL = `https://app.builderbot.cloud/api/v2/${projectId}/messages`;
const WHATSAPP_STATUS_KEY = 'pizzeria-whatsapp-status';
const WHATSAPP_CONNECTION_TIME_KEY = 'pizzeria-whatsapp-connection-time';
const WEBHOOK_LOGS_SHEET_NAME = "WhastappAssistant_logs";

export type BotApiStatus = 'READY_TO_SCAN' | 'ACTIVE' | 'DISCONNECTED';

export const initiateWhatsAppDeploy = async (): Promise<boolean> => {
    const response = await fetch(DEPLOY_URL, {
        method: 'POST',
        headers: {
            'x-api-builderbot': builderBotApiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectId })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to read error response.');
        throw new Error(`Error al iniciar el bot: ${response.status}. Detalles: ${errorText}`);
    }
    return true;
};

export const getWhatsAppQR = async (): Promise<string> => {
    const qrResponse = await fetch(`${DEPLOY_URL}/${projectId}/qr`, {
        headers: { 'x-api-builderbot': builderBotApiKey },
    });

    if (!qrResponse.ok) {
        const errorText = await qrResponse.text().catch(() => 'Failed to read error response.');
        throw new Error(`Error al obtener el código QR: ${qrResponse.status}. Detalles: ${errorText}`);
    }

    try {
        const blob = await qrResponse.blob();
        if (!blob.type.startsWith('image/')) {
            const text = await blob.text();
            console.error("QR endpoint returned non-image data:", text);
            throw new Error('La API devolvió una respuesta inesperada para el QR.');
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error processing QR image:', error);
        throw new Error('No se pudo procesar la imagen del QR.');
    }
};

export const getWhatsAppStatus = async (): Promise<BotApiStatus> => {
    const response = await fetch(`${DEPLOY_URL}/${projectId}?x-api-builderbot=${builderBotApiKey}`, {
        headers: { 'x-api-builderbot': builderBotApiKey }
    });

    if (response.status === 404) {
        return 'DISCONNECTED';
    }

    if (!response.ok) {
        return 'DISCONNECTED';
    }
    
    const data = await response.json();

    if (data && data.deploy && data.deploy.status) {
        const status = data.deploy.status;
        if (status === 'ACTIVE' || status === 'ONLINE') {
            return 'ACTIVE';
        }
        if (status === 'READY_TO_SCAN') {
            return 'READY_TO_SCAN';
        }
    }
    
    return 'DISCONNECTED';
};

export const disconnectWhatsAppBot = async (): Promise<boolean> => {
    const response = await fetch(`${DEPLOY_URL}/${projectId}`, {
        method: 'DELETE',
        headers: { 'x-api-builderbot': builderBotApiKey },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text().catch(() => 'Failed to read error response.');
      throw new Error(`Error al desconectar el bot: ${response.status}. Detalles: ${errorText}`);
    }
    return true;
};


export const getPersistedStatus = (): 'active' | 'disconnected' => {
    const status = localStorage.getItem(WHATSAPP_STATUS_KEY);
    return status === 'active' ? 'active' : 'disconnected';
};

export const getPersistedConnectionTime = (): string | null => {
    return localStorage.getItem(WHATSAPP_CONNECTION_TIME_KEY);
};

const persistConnectionTime = (time: string | null) => {
    if (time) {
        localStorage.setItem(WHATSAPP_CONNECTION_TIME_KEY, time);
    } else {
        localStorage.removeItem(WHATSAPP_CONNECTION_TIME_KEY);
    }
};

export const persistStatus = (status: 'active' | 'disconnected') => {
    if (status === 'active') {
        localStorage.setItem(WHATSAPP_STATUS_KEY, 'active');
        // Only set connection time if it doesn't exist to mark the start
        if (!getPersistedConnectionTime()) {
            persistConnectionTime(new Date().toISOString());
        }
    } else {
        localStorage.removeItem(WHATSAPP_STATUS_KEY);
        persistConnectionTime(null); // Clear connection time on disconnect
    }
};

export const sendWhatsAppMessage = async (number: string, content: string, mediaUrl?: string): Promise<{ success: boolean; error?: string }> => {
    const messageObject: { content: string; mediaUrl?: string } = {
        content,
    };

    if (mediaUrl && mediaUrl.trim() !== '') {
        messageObject.mediaUrl = mediaUrl.trim();
    }

    const body: any = {
        // Fix based on API error: Expects a single object, not an array.
        messages: messageObject,
        // Fix based on API error: Ensure number is always a string.
        number: String(number),
        checkIfExists: false,
    };

    try {
        const response = await fetch(MESSAGES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-builderbot': builderBotV2ApiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorText;
            try {
                const errorData = await response.json();
                console.error('Error sending WhatsApp message:', response.status, JSON.stringify(errorData, null, 2));
                // Try to get a more specific message from the error response
                if (errorData.error && Array.isArray(errorData.error) && errorData.error.length > 0) {
                     errorText = errorData.error.map((e: any) => e.message).join(', ');
                } else {
                    errorText = errorData.message || JSON.stringify(errorData);
                }
            } catch (e) {
                errorText = await response.text();
                console.error('Error sending WhatsApp message (non-JSON response):', response.status, errorText);
            }
            return { success: false, error: errorText || `Error ${response.status}` };
        }
        
        return { success: true };

    } catch (err) {
        console.error('Network error sending WhatsApp message:', err);
        return { success: false, error: 'Error de red' };
    }
};

export const sendWhatsAppGroupMessage = async (groupId: string, content: string, mediaUrl?: string): Promise<{ success: boolean; error?: string }> => {
    const messageObject: { content: string; mediaUrl?: string } = {
        content,
    };

    if (mediaUrl && mediaUrl.trim() !== '') {
        messageObject.mediaUrl = mediaUrl.trim();
    }

    const body: any = {
        // Fix based on API error: Expects a single object, not an array.
        messages: messageObject,
        // Fix based on API error: Ensure groupId is always a string.
        number: String(groupId),
        checkIfExists: false,
    };

    try {
        const response = await fetch(MESSAGES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-builderbot': builderBotV2ApiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorText;
            try {
                const errorData = await response.json();
                console.error('Error sending WhatsApp group message:', response.status, JSON.stringify(errorData, null, 2));
                if (errorData.error && Array.isArray(errorData.error) && errorData.error.length > 0) {
                     errorText = errorData.error.map((e: any) => e.message).join(', ');
                } else {
                    errorText = errorData.message || JSON.stringify(errorData);
                }
            } catch (e) {
                errorText = await response.text();
                console.error('Error sending WhatsApp group message (non-JSON response):', response.status, errorText);
            }
            return { success: false, error: errorText || `Error ${response.status}` };
        }
        
        return { success: true };

    } catch (err) {
        console.error('Network error sending WhatsApp group message:', err);
        return { success: false, error: 'Error de red' };
    }
};

export const logStatusChange = async (status: string, details: string): Promise<void> => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventName: 'status.change.frontend',
            projectId: projectId,
            from: 'Frontend Panel',
            details: details,
            rawPayload: JSON.stringify({ status, details }),
            unhandledStatus: '',
            botStatus: status
        };

        await apiService.post('addData', {
            sheetName: WEBHOOK_LOGS_SHEET_NAME,
            item: logEntry
        });
    } catch (error) {
        console.error("Failed to log WhatsApp status change:", error);
    }
};