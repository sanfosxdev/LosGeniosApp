import type { ChatMessage } from '../types';

export const sendMessageToGemini = async (history: ChatMessage[], actionLock: 'order' | 'reservation' | null = null): Promise<{ text: string }> => {
    const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat', payload: { history, actionLock } }),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to get response from assistant.' }));
        throw new Error(error.message || 'Failed to get response from assistant.');
    }
    return response.json();
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'transcribe', payload: { audioData: { base64: base64Audio, mimeType } } }),
    });
    if (!response.ok) {
         const error = await response.json().catch(() => ({ message: 'Failed to transcribe audio.'}));
        throw new Error(error.message || 'Failed to transcribe audio.');
    }
    const data = await response.json();
    return data.text;
};
