import React, { useState, useEffect } from 'react';
import { toastService, ToastType } from '../../services/toastService';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { CloseIcon } from '../icons/CloseIcon';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

const ToastComponent: React.FC<{ toast: Toast, onClose: () => void }> = ({ toast, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: <CheckCircleIcon className="w-6 h-6 text-green-500" />,
        error: <XCircleIcon className="w-6 h-6 text-red-500" />,
        info: <InfoIcon className="w-6 h-6 text-blue-500" />,
    };

    const colors = {
        success: 'bg-green-100 dark:bg-green-900/50 border-green-400',
        error: 'bg-red-100 dark:bg-red-900/50 border-red-400',
        info: 'bg-blue-100 dark:bg-blue-900/50 border-blue-400',
    };

    return (
        <div className={`max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border-l-4 ${colors[toast.type]} animate-fade-in`}>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">{icons[toast.type]}</div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{toast.message}</p>
                    </div>
                     <div className="ml-4 flex-shrink-0 flex">
                        <button onClick={onClose} className="inline-flex text-gray-400 dark:text-gray-500 rounded-md hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            <span className="sr-only">Close</span>
                            <CloseIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const unsubscribe = toastService.listen((newToast) => {
            if (newToast) {
                setToasts(prev => [...prev, newToast]);
            }
        });
        return unsubscribe;
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    if (toasts.length === 0) return null;

    return (
        <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]">
            <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
                {toasts.map(toast => (
                    <ToastComponent key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </div>
    );
};
