import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../icons/CloseIcon';

interface WhatsAppQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeUrl: string | null;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const WhatsAppQRCodeModal: React.FC<WhatsAppQRCodeModalProps> = ({ isOpen, onClose, qrCodeUrl }) => {
    const [timeLeft, setTimeLeft] = useState(480); // 8 minutes in seconds

    useEffect(() => {
        if (!isOpen) {
            setTimeLeft(480); // Reset timer when closed
            return;
        }

        if (timeLeft <= 0) {
            // Optionally auto-close or show a "expired" message
            return;
        }

        const intervalId = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isOpen, timeLeft]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform animate-slide-in-up">
                <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Conectar WhatsApp</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 text-center">
                    {qrCodeUrl ? (
                        <>
                            <img 
                                src={qrCodeUrl} 
                                alt="Escanea para conectar WhatsApp" 
                                className="mx-auto rounded-lg border dark:border-gray-700 w-64 h-64"
                                style={{ imageRendering: 'pixelated' }}
                            />
                            <p className="mt-4 text-gray-600 dark:text-gray-300">
                                Escanea este código QR con tu aplicación de WhatsApp para conectar el asistente.
                            </p>
                            <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
                                {timeLeft > 0 ? `El código expira en: ${formatTime(timeLeft)}` : '¡El código ha expirado! Por favor, inténtalo de nuevo.'}
                            </p>
                        </>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-300">Generando código QR...</p>
                    )}
                </div>
                <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Cerrar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default WhatsAppQRCodeModal;