import type { SliceBotMetrics, ChatHistorySession, ChatMessage } from '../types';
import apiService from './apiService';

const METRICS_STORAGE_KEY = 'pizzeria-slice-bot-metrics';
const MAX_HISTORY_SESSIONS = 100;
const METRICS_SHEET_NAME = 'SliceBotMetrics';
const CHAT_HISTORY_SHEET_NAME = 'ChatHistory';


// Simple token estimation: average token is ~4 chars
const estimateTokens = (text: string): number => {
    return Math.ceil((text || '').length / 4);
};

interface StoredData {
    metrics: SliceBotMetrics;
    chatHistory: ChatHistorySession[];
}

const getDefaultData = (): StoredData => ({
    metrics: {
        distinctCustomers: 0,
        totalMessages: 0,
        totalTokensUsed: 0,
        ordersMade: 0,
        reservationsMade: 0,
    },
    chatHistory: [],
});

const getStoredData = (): StoredData => {
    try {
        const dataJson = localStorage.getItem(METRICS_STORAGE_KEY);
        if (dataJson) {
            const data = JSON.parse(dataJson) as StoredData;
            // Ensure default structure if parts are missing
            return {
                metrics: { ...getDefaultData().metrics, ...data.metrics },
                chatHistory: data.chatHistory || [],
            };
        }
        return getDefaultData();
    } catch (error) {
        console.error("Failed to parse slice bot metrics from localStorage", error);
        return getDefaultData();
    }
};

const persistData = (data: StoredData): void => {
    try {
        localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save slice bot metrics to localStorage", error);
    }

    // Persist to Google Sheet (fire and forget)
    apiService.post('syncDataType', {
        sheetName: METRICS_SHEET_NAME,
        items: [data.metrics],
        headers: ['distinctCustomers', 'totalMessages', 'totalTokensUsed', 'ordersMade', 'reservationsMade']
    }).catch(e => console.error("Error syncing SliceBot metrics:", e));

    apiService.post('syncDataType', {
        sheetName: CHAT_HISTORY_SHEET_NAME,
        items: data.chatHistory,
        headers: ['id', 'startTime', 'messages', 'outcome', 'tokensUsed', 'lastActivity']
    }).catch(e => console.error("Error syncing SliceBot chat history:", e));
};

export const fetchAndCacheSliceBotData = async (): Promise<void> => {
    try {
        const [metricsResponse, historyResponse] = await Promise.all([
            apiService.get(METRICS_SHEET_NAME),
            apiService.get(CHAT_HISTORY_SHEET_NAME)
        ]);
        
        const metrics = (metricsResponse && metricsResponse[0]) ? metricsResponse[0] : getDefaultData().metrics;
        const chatHistory = historyResponse || [];
        
        const data: StoredData = { metrics, chatHistory };
        localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(data));

    } catch (error) {
        console.warn('Failed to fetch Slice Bot data from sheet, using local cache.', error);
    }
};

export const startSession = (): string => {
    const data = getStoredData();
    const sessionId = `SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const newSession: ChatHistorySession = {
        id: sessionId,
        startTime: now,
        messages: [],
        outcome: null,
        tokensUsed: 0,
        lastActivity: now,
    };

    data.metrics.distinctCustomers += 1;
    data.chatHistory.unshift(newSession); // Add to the beginning

    // Keep history trimmed to the max size
    if (data.chatHistory.length > MAX_HISTORY_SESSIONS) {
        data.chatHistory.pop();
    }

    persistData(data);
    return sessionId;
};

export const logMessage = (sessionId: string, message: ChatMessage): void => {
    const data = getStoredData();
    const sessionIndex = data.chatHistory.findIndex(s => s.id === sessionId);

    if (sessionIndex > -1) {
        const session = data.chatHistory[sessionIndex];
        const messageTokens = estimateTokens(message.text);
        
        session.messages.push(message);
        session.tokensUsed += messageTokens;
        session.lastActivity = new Date().toISOString();
        
        data.metrics.totalMessages += 1;
        data.metrics.totalTokensUsed += messageTokens;

        persistData(data);
    }
};

export const logOutcome = (sessionId: string, outcome: 'order' | 'reservation'): void => {
    const data = getStoredData();
    const sessionIndex = data.chatHistory.findIndex(s => s.id === sessionId);

    if (sessionIndex > -1) {
        const session = data.chatHistory[sessionIndex];
        if (session.outcome) return; // Only log the first outcome

        session.outcome = outcome;
        session.lastActivity = new Date().toISOString();

        if (outcome === 'order') {
            data.metrics.ordersMade += 1;
        } else if (outcome === 'reservation') {
            data.metrics.reservationsMade += 1;
        }

        persistData(data);
    }
};

export const getMetrics = (): SliceBotMetrics => {
    return getStoredData().metrics;
};

export const getChatHistory = (): ChatHistorySession[] => {
    return getStoredData().chatHistory;
};

export const getLocalDataForSync = () => {
    const data = getStoredData();
    return {
        sliceBotMetrics: [data.metrics],
        chatHistory: data.chatHistory
    }
}