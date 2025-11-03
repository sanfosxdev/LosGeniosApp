export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

type Listener = (toast: Toast) => void;

let listeners: Listener[] = [];
let toastId = 0;

export const toastService = {
    listen: (listener: Listener): (() => void) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    },
    show: (message: string, type: ToastType = 'info') => {
        const newToast: Toast = { id: toastId++, message, type };
        for (const listener of listeners) {
            listener(newToast);
        }
    }
};
