
import type { WhatsAppBotMetrics, ChatHistorySession, ChatMessage, Order, Reservation } from '../types';
import { CreatedBy, MessageSender } from '../types';
import apiService from './apiService';

const WHATSAPP_METRICS_STORAGE_KEY = 'pizzeria-whatsapp-bot-metrics';
const MAX_HISTORY_SESSIONS = 100;

interface WhatsAppHistoryMessage {
    timestamp: string;
    messageId: string;
    direction: 'incoming' | 'outgoing';
    from: string;
    to: string;
    body: string;
    mediaUrl: string;
    rawPayload: string;
}

interface StoredWhatsAppData {
    metrics: WhatsAppBotMetrics;
    chatHistory: ChatHistorySession[];
}

const getDefaultData = (): StoredWhatsAppData => ({
    metrics: {
        distinctCustomers: 0,
        totalMessages: 0,
        ordersMade: 0,
        reservationsMade: 0,
    },
    chatHistory: [],
});

const getStoredData = (): StoredWhatsAppData => {
    try {
        const dataJson = localStorage.getItem(WHATSAPP_METRICS_STORAGE_KEY);
        if (dataJson) {
            const data = JSON.parse(dataJson) as StoredWhatsAppData;
            return {
                metrics: { ...getDefaultData().metrics, ...data.metrics },
                chatHistory: data.chatHistory || [],
            };
        }
        return getDefaultData();
    } catch (error) {
        console.error("Failed to parse whatsapp bot metrics from localStorage", error);
        return getDefaultData();
    }
};

const persistData = (data: StoredWhatsAppData): void => {
    try {
        localStorage.setItem(WHATSAPP_METRICS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save whatsapp bot metrics to localStorage", error);
    }
};

// This function will be called from the main dashboard poll
export const fetchAndCacheWhatsAppBotData = async (): Promise<void> => {
    try {
        const [historyResponse, ordersResponse, reservationsResponse] = await Promise.all([
            apiService.get('WhatsappsHistory'),
            apiService.get('Orders'),
            apiService.get('Reservations')
        ]);

        const history: WhatsAppHistoryMessage[] = historyResponse || [];
        const orders: Order[] = ordersResponse || [];
        const reservations: Reservation[] = reservationsResponse || [];

        // Calculate Metrics
        const distinctCustomers = new Set(history.map(msg => msg.from)).size;
        const totalMessages = history.length;
        const ordersMade = orders.filter(o => o.createdBy === CreatedBy.WHATSAPP_ASSISTANT).length;
        const reservationsMade = reservations.filter(r => r.createdBy === CreatedBy.WHATSAPP_ASSISTANT).length;

        const metrics: WhatsAppBotMetrics = {
            distinctCustomers,
            totalMessages,
            ordersMade,
            reservationsMade
        };

        // Process Chat History
        const sessionsMap = new Map<string, ChatHistorySession>();

        // Sort history by timestamp to process in order
        history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        history.forEach(msg => {
            const customerPhone = msg.from; // Group by the 'from' field, assuming it's always the customer
            
            const chatMessage: ChatMessage = {
                sender: msg.direction === 'incoming' ? MessageSender.USER : MessageSender.BOT,
                text: msg.body
            };

            if (!sessionsMap.has(customerPhone)) {
                // Check for outcomes associated with this customer
                const customerOrders = orders.filter(o => o.createdBy === CreatedBy.WHATSAPP_ASSISTANT && o.customer.phone === customerPhone).length > 0;
                const customerReservations = reservations.filter(r => r.createdBy === CreatedBy.WHATSAPP_ASSISTANT && r.customerPhone === customerPhone).length > 0;
                let outcome: 'order' | 'reservation' | null = null;
                if (customerOrders) outcome = 'order';
                else if (customerReservations) outcome = 'reservation';

                sessionsMap.set(customerPhone, {
                    id: customerPhone,
                    startTime: msg.timestamp,
                    messages: [chatMessage],
                    outcome: outcome,
                    tokensUsed: 0, // Not applicable for WhatsApp bot
                    lastActivity: msg.timestamp,
                });
            } else {
                const session = sessionsMap.get(customerPhone)!;
                session.messages.push(chatMessage);
                session.lastActivity = msg.timestamp;
            }
        });

        // Convert map to array and sort by last activity
        const chatHistory = Array.from(sessionsMap.values())
                                 .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
                                 .slice(0, MAX_HISTORY_SESSIONS);

        persistData({ metrics, chatHistory });

    } catch (error) {
        console.warn('Failed to fetch WhatsApp Bot data from sheet, using local cache.', error);
    }
};

export const getMetrics = (): WhatsAppBotMetrics => {
    return getStoredData().metrics;
};

export const getChatHistory = (): ChatHistorySession[] => {
    return getStoredData().chatHistory;
};
