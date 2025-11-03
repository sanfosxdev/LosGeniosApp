
import React, { useState, useEffect } from 'react';
import type { BulkSendJob } from '../../types';
import { XCircleIcon } from '../icons/XCircleIcon';
import { CloseIcon } from '../icons/CloseIcon';

interface BulkSendStatusProps {
    job: BulkSendJob;
    onCancel: () => void;
    onClose: () => void;
}

const formatDuration = (milliseconds: number): string => {
    if (milliseconds < 0) milliseconds = 0;
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const BulkSendStatus: React.FC<BulkSendStatusProps> = ({ job, onCancel, onClose }) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const { status, total, sent, failed, startTime, isCancelled } = job;
    const isRunning = status === 'running';

    useEffect(() => {
        if (isRunning) {
            const timer = setInterval(() => {
                setElapsedTime(Date.now() - startTime);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isRunning, startTime]);
    
    const progress = total > 0 ? (sent / total) * 100 : 0;

    const getStatusInfo = () => {
        switch (status) {
            case 'running': return { text: `Enviando... ${sent} de ${total}`, color: 'bg-blue-500', icon: <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-white"></div> };
            case 'completed': return { text: `Completado: ${sent - failed} enviados, ${failed} errores.`, color: 'bg-green-500', icon: null };
            case 'cancelled': return { text: 'Envío cancelado.', color: 'bg-yellow-500', icon: null };
            case 'error': return { text: 'Error en el envío.', color: 'bg-red-500', icon: null };
            default: return { text: 'Iniciando...', color: 'bg-gray-500', icon: null };
        }
    };
    
    const statusInfo = getStatusInfo();

    return (
        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 shadow-md animate-fade-in">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {statusInfo.icon}
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {statusInfo.text}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {isRunning ? formatDuration(elapsedTime) : ''}
                     </span>
                     {isRunning ? (
                         <button onClick={onCancel} className="p-1 text-red-500 hover:text-red-700" title="Cancelar Envío">
                            <XCircleIcon className="w-6 h-6"/>
                        </button>
                     ) : (
                         <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700" title="Cerrar">
                            <CloseIcon className="w-5 h-5"/>
                        </button>
                     )}
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ${statusInfo.color}`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default BulkSendStatus;
