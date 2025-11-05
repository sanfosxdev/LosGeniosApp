import type { SliceBotMetrics, ChatHistorySession, ChatMessage } from '../types';
// Fix: Import 'getDoc' from firebase to fix 'Cannot find name' error.
import { db, collection, getDocs, doc, setDoc, writeBatch, query, orderBy, limit, getDoc } from './firebase';

const METRICS_STORAGE_KEY = 'pizzeria-slice-bot-metrics';
const MAX_HISTORY_SESSIONS = 100;
const METRICS_COLLECTION_NAME = 'SliceBotMetrics';
const METRICS_DOC_ID = 'main';
const CHAT_HISTORY_COLLECTION_NAME = 'ChatHistory';


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
        
        // Persist to Firebase (fire and forget)
        const metricsRef = doc(db, METRICS_COLLECTION_NAME, METRICS_DOC_ID);
        setDoc(metricsRef, data.metrics, { merge: true }).catch(e => console.error("Error syncing SliceBot metrics:", e));

        if (data.chatHistory.length > 0) {
            const latestSession = data.chatHistory[0];
            const historyRef = doc(db, CHAT_HISTORY_COLLECTION_NAME, latestSession.id);
            setDoc(historyRef, latestSession).catch(e => console.error("Error syncing SliceBot chat history:", e));
        }

    } catch (error) {
        console.error("Failed to save slice bot metrics to localStorage", error);
    }
};

export const fetchAndCacheSliceBotData = async (): Promise<void> => {
    try {
        const metricsRef = doc(db, METRICS_COLLECTION_NAME, METRICS_DOC_ID);
        const historyQuery = query(collection(db, CHAT_HISTORY_COLLECTION_NAME), orderBy('startTime', 'desc'), limit(MAX_HISTORY_SESSIONS));

        const [metricsSnap, historySnap] = await Promise.all([
            getDoc(metricsRef),
            getDocs(historyQuery)
        ]);
        
        const metrics = metricsSnap.exists() ? (metricsSnap.data() as SliceBotMetrics) : getDefaultData().metrics;
        const chatHistory = historySnap.docs.map(doc => doc.data() as ChatHistorySession);
        
        persistData({ metrics, chatHistory });

    } catch (error) {
        console.warn('Failed to fetch Slice Bot data from Firebase, using local cache.', error);
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

export const updateMetricsCache = (metrics: SliceBotMetrics) => {
    const data = getStoredData();
    data.metrics = metrics;
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(data));
};

export const updateChatHistoryCache = (chatHistory: ChatHistorySession[]) => {
    const data = getStoredData();
    // Sort descending by start time
    data.chatHistory = chatHistory.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(data));
};