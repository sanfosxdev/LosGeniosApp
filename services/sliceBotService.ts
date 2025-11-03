const SLICE_BOT_STATUS_KEY = 'pizzeria-slice-bot-status';
const SLICE_BOT_CONNECTION_TIME_KEY = 'pizzeria-slice-bot-connection-time';
const SLICE_BOT_LAST_UPDATE_KEY = 'pizzeria-slice-bot-last-update';


export type SliceBotStatus = 'active' | 'inactive';

// The bot is active by default if no status is set.
export const getSliceBotStatus = (): SliceBotStatus => {
    try {
        const status = localStorage.getItem(SLICE_BOT_STATUS_KEY);
        if (status === 'active' || status === 'inactive') {
            return status;
        }
        // If status is not set, initialize it and related keys
        const defaultStatus = 'active';
        localStorage.setItem(SLICE_BOT_STATUS_KEY, defaultStatus);
        const now = new Date().toISOString();
        localStorage.setItem(SLICE_BOT_LAST_UPDATE_KEY, now);
        localStorage.setItem(SLICE_BOT_CONNECTION_TIME_KEY, now);
        return defaultStatus;
    } catch (error) {
        console.error("Failed to get Slice bot status from localStorage", error);
        return 'active';
    }
};

export const setSliceBotStatus = (status: SliceBotStatus): void => {
    try {
        const currentStatus = getSliceBotStatus();
        localStorage.setItem(SLICE_BOT_STATUS_KEY, status);
        localStorage.setItem(SLICE_BOT_LAST_UPDATE_KEY, new Date().toISOString());

        if (status === 'active' && currentStatus !== 'active') {
            localStorage.setItem(SLICE_BOT_CONNECTION_TIME_KEY, new Date().toISOString());
        } else if (status === 'inactive') {
            localStorage.removeItem(SLICE_BOT_CONNECTION_TIME_KEY);
        }
    } catch (error) {
        console.error("Failed to set Slice bot status in localStorage", error);
    }
};

export const getSliceBotConnectionTime = (): string | null => {
    try {
        return localStorage.getItem(SLICE_BOT_CONNECTION_TIME_KEY);
    } catch (error) {
        console.error("Failed to get Slice bot connection time from localStorage", error);
        return null;
    }
};


export const getSliceBotLastUpdate = (): string | null => {
    try {
        return localStorage.getItem(SLICE_BOT_LAST_UPDATE_KEY);
    } catch (error) {
        console.error("Failed to get Slice bot last update time from localStorage", error);
        return null;
    }
};