import React, { useState, useEffect, useRef } from 'react';
import { BotIcon } from '../icons/BotIcon';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import * as whatsAppBotService from '../../services/whatsappBotService';
import * as sliceBotService from '../../services/sliceBotService';
import WhatsAppQRCodeModal from './WhatsAppQRCodeModal';
import type { WhatsAppBotStatus } from '../../types';
import type { SliceBotStatus } from '../../services/sliceBotService';
import type { SliceBotMetrics, ChatHistorySession } from '../../types';
import * as sliceBotMetricsService from '../../services/sliceBotMetricsService';
import { RefreshIcon } from '../icons/RefreshIcon';
import UptimeTimer from './UptimeTimer';
import { TelegramIcon } from '../icons/TelegramIcon';
import { InstagramIcon } from '../icons/InstagramIcon';
import { FacebookMessengerIcon } from '../icons/FacebookMessengerIcon';
import { CloseIcon } from '../icons/CloseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { MessageSquareIcon } from '../icons/MessageSquareIcon';
import { CpuIcon } from '../icons/CpuIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { HistoryIcon } from '../icons/HistoryIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ChevronUpIcon } from '../icons/ChevronUpIcon';
import { UserIcon } from '../icons/UserIcon';


interface BotsPanelProps {
  status: WhatsAppBotStatus;
  setStatus: (status: WhatsAppBotStatus) => void;
  checkStatus: (force?: boolean) => Promise<void>;
  lastStatusCheck: Date | null;
  onSliceBotStatusChange: (newStatus: SliceBotStatus) => void;
}

const BotsPanel: React.FC<BotsPanelProps> = ({ status, setStatus, checkStatus, lastStatusCheck, onSliceBotStatusChange }) => {
    // WhatsApp State
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [connectionTime, setConnectionTime] = useState<string | null>(null);
    const poller = useRef<number | null>(null);

    // Slice Bot State
    const [sliceStatus, setSliceStatus] = useState<SliceBotStatus>('inactive');
    const [sliceConnectionTime, setSliceConnectionTime] = useState<string | null>(null);
    const [sliceLastUpdate, setSliceLastUpdate] = useState<string | null>(null);
    const [isSliceChecking, setIsSliceChecking] = useState(false);
    
    // Details State
    const [sliceMetrics, setSliceMetrics] = useState<SliceBotMetrics | null>(null);
    const [sliceChatHistory, setSliceChatHistory] = useState<ChatHistorySession[]>([]);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

    // View State
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);

    const isBusy = status === 'initiating' || status === 'scanning' || status === 'disconnecting';

    const stopPolling = () => {
        if (poller.current) {
            clearInterval(poller.current);
            poller.current = null;
        }
    };

    // Clean up poller on unmount
    useEffect(() => {
        return () => stopPolling();
    }, []);
    
    const refreshSliceStatus = () => {
        setIsSliceChecking(true);
        setTimeout(() => { // Simulate a quick refresh
            setSliceStatus(sliceBotService.getSliceBotStatus());
            setSliceConnectionTime(sliceBotService.getSliceBotConnectionTime());
            setSliceLastUpdate(sliceBotService.getSliceBotLastUpdate());
            setIsSliceChecking(false);
        }, 200);
    };

    useEffect(() => {
        refreshSliceStatus();
        if (status === 'active') {
            setConnectionTime(whatsAppBotService.getPersistedConnectionTime());
        } else {
            setConnectionTime(null);
        }
    }, [status]);
    
    useEffect(() => {
        if (isDetailsVisible) {
            setSliceMetrics(sliceBotMetricsService.getMetrics());
            setSliceChatHistory(sliceBotMetricsService.getChatHistory());
        }
    }, [isDetailsVisible]);

    useEffect(() => {
        if (isQrModalOpen && (status === 'ready_to_scan' || status === 'scanning')) {
            const qrPoll = async () => {
                const apiStatus = await whatsAppBotService.getWhatsAppStatus();
                if (apiStatus === 'ACTIVE') {
                    setStatus('active');
                    whatsAppBotService.persistStatus('active');
                    setIsQrModalOpen(false);
                    setQrCodeUrl(null);
                }
            };
            const intervalId = setInterval(qrPoll, 5000);
            return () => clearInterval(intervalId);
        }
    }, [isQrModalOpen, status, setStatus]);

    const handleStartBot = async () => {
        stopPolling();
        setStatus('initiating');
        setError(null);
        try {
            await whatsAppBotService.initiateWhatsAppDeploy();
            const startTime = Date.now();
            poller.current = window.setInterval(async () => {
                const apiStatus = await whatsAppBotService.getWhatsAppStatus();
                const timedOut = Date.now() - startTime > 30000; // 30 sec timeout

                if (apiStatus === 'READY_TO_SCAN') {
                    stopPolling();
                    checkStatus(true);
                } else if (timedOut) {
                    stopPolling();
                    setError('La solicitud de inicio tardó demasiado en responder.');
                    setStatus('error');
                }
            }, 3000);
        } catch (err) {
            stopPolling();
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Ocurrió un error desconocido al iniciar.');
            }
            setStatus('error');
        }
    };

    const handleScanQR = async () => {
        setStatus('scanning');
        setError(null);
        try {
            const url = await whatsAppBotService.getWhatsAppQR();
            setQrCodeUrl(url);
            setIsQrModalOpen(true);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Ocurrió un error desconocido al obtener el QR.');
            }
            setStatus('error');
        }
    };
    
    const handleDisconnect = async () => {
        stopPolling();
        setStatus('disconnecting');
        setError(null);
        try {
            await whatsAppBotService.disconnectWhatsAppBot();
            const startTime = Date.now();
            poller.current = window.setInterval(async () => {
                const apiStatus = await whatsAppBotService.getWhatsAppStatus();
                const timedOut = Date.now() - startTime > 30000; // 30 sec timeout
                
                if (apiStatus === 'DISCONNECTED') {
                    stopPolling();
                    checkStatus(true);
                } else if (timedOut) {
                    stopPolling();
                    setError('La solicitud de desconexión tardó demasiado en responder.');
                    setStatus('error');
                }
            }, 3000);
        } catch (err) {
            stopPolling();
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Ocurrió un error desconocido al desconectar.');
            }
            setStatus('error');
        }
    };
    
    const handleCloseQrModal = () => {
        setIsQrModalOpen(false);
        setQrCodeUrl(null);
        if (status === 'scanning') {
             checkStatus(true);
        }
    };

    const handleRefreshStatus = async () => {
        setIsChecking(true);
        await checkStatus(true);
        setIsChecking(false);
    };

    const handleToggleSliceBot = () => {
        const newStatus = sliceStatus === 'active' ? 'inactive' : 'active';
        sliceBotService.setSliceBotStatus(newStatus);
        setSliceStatus(newStatus);
        onSliceBotStatusChange(newStatus);
        refreshSliceStatus();
    };

    const renderSpinner = (text: string) => (
        <div className="flex justify-center items-center space-x-2 text-gray-600 dark:text-gray-300">
            <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-primary"></div>
            <span>{text}</span>
        </div>
    );

    const renderStatusAndActions = () => {
        switch (status) {
            case 'disconnected':
                return <button onClick={handleStartBot} disabled={isBusy} className="w-full bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Iniciar</button>;
            case 'initiating':
                return renderSpinner('Iniciando...');
            case 'disconnecting':
                return renderSpinner('Desconectando...');
            case 'ready_to_scan':
                return (
                    <div className="flex flex-col sm:flex-row gap-2 justify-center w-full">
                        <button onClick={handleScanQR} disabled={isBusy} className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">Escanear QR</button>
                        <button onClick={handleDisconnect} disabled={isBusy} className="flex-1 bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 disabled:bg-gray-400">Cancelar</button>
                    </div>
                );
            case 'scanning':
                return <p className="text-gray-600 dark:text-gray-300">Esperando escaneo...</p>;
            case 'active':
                return <button onClick={handleDisconnect} disabled={isBusy} className="w-full bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed">Desconectar</button>;
            case 'error':
                 return (
                    <div className="text-red-600 dark:text-red-400 text-center">
                        <p><strong>Error:</strong> {error || 'Ocurrió un error.'}</p>
                        <button onClick={() => setStatus('disconnected')} className="mt-2 text-sm underline">Volver a intentar</button>
                    </div>
                 );
        }
    };
    
    const renderStatusDisplay = () => {
        const statusInfo: Record<WhatsAppBotStatus, { text: string; color: string }> = {
            disconnected: { text: 'Desconectado', color: 'bg-red-500' },
            initiating: { text: 'Iniciando...', color: 'bg-yellow-500 animate-pulse' },
            disconnecting: { text: 'Desconectando...', color: 'bg-yellow-500 animate-pulse' },
            ready_to_scan: { text: 'Listo para Escanear', color: 'bg-blue-500' },
            scanning: { text: 'Esperando Escaneo...', color: 'bg-yellow-500 animate-pulse' },
            active: { text: 'Conectado', color: 'bg-green-500' },
            error: { text: 'Error', color: 'bg-red-500' },
        };

        const currentStatus = statusInfo[status];

        return (
            <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className={`h-4 w-4 rounded-full ${currentStatus.color}`}></span>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{currentStatus.text}</p>
                    </div>
                    <button 
                        onClick={handleRefreshStatus} 
                        disabled={isBusy || isChecking}
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Refrescar estado"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {status === 'active' && connectionTime && (
                    <div className="text-sm text-center border-t dark:border-gray-600 pt-3">
                        <p className="text-gray-600 dark:text-gray-400">Tiempo de conexión:</p>
                        <div className="text-lg text-gray-800 dark:text-gray-200">
                            <UptimeTimer startTime={connectionTime} />
                        </div>
                    </div>
                )}
                <div className="text-xs text-center text-gray-400 dark:text-gray-500 border-t dark:border-gray-600 pt-2">
                    Última actualización: {lastStatusCheck ? lastStatusCheck.toLocaleString('es-AR') : 'Nunca'}
                </div>
            </div>
        );
    };

     const renderSliceDetails = () => {
        if (!sliceMetrics) return <p>Cargando métricas...</p>;

        const metricCards = [
            { label: 'Clientes Atendidos', value: sliceMetrics.distinctCustomers.toLocaleString(), icon: <UsersIcon className="w-8 h-8 text-blue-500" /> },
            { label: 'Mensajes Totales', value: sliceMetrics.totalMessages.toLocaleString(), icon: <MessageSquareIcon className="w-8 h-8 text-teal-500" /> },
            { label: 'Tokens Usados (est.)', value: `~${sliceMetrics.totalTokensUsed.toLocaleString()}`, icon: <CpuIcon className="w-8 h-8 text-indigo-500" /> },
            { label: 'Pedidos Realizados', value: sliceMetrics.ordersMade.toLocaleString(), icon: <PackageIcon className="w-8 h-8 text-green-500" /> },
            { label: 'Reservas Realizadas', value: sliceMetrics.reservationsMade.toLocaleString(), icon: <CalendarIcon className="w-8 h-8 text-purple-500" /> },
        ];
        
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {metricCards.map(card => (
                        <div key={card.label} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg text-center shadow">
                            <div className="flex justify-center items-center mb-2">{card.icon}</div>
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{card.value}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                        </div>
                    ))}
                </div>
                
                <div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <HistoryIcon className="w-6 h-6"/>
                        Historial de Chats (Últimos {sliceChatHistory.length})
                    </h3>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {sliceChatHistory.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400">No hay historial de chats todavía.</p>
                        ) : (
                            sliceChatHistory.map(session => (
                                <div key={session.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <button onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)} className="w-full p-3 flex justify-between items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-700 dark:text-gray-200">
                                                Sesión: {new Date(session.startTime).toLocaleString('es-AR')}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Resultado: {session.outcome || 'Inconcluso'} | Tokens: ~{session.tokensUsed} | Mensajes: {session.messages.length}
                                            </p>
                                        </div>
                                        {expandedSessionId === session.id ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                                    </button>
                                    {expandedSessionId === session.id && (
                                        <div className="p-4 border-t dark:border-gray-600 space-y-2">
                                            {session.messages.map((msg, index) => (
                                                 <div key={index} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    {msg.sender === 'bot' && <BotIcon className="w-6 h-6 flex-shrink-0 text-primary" />}
                                                    <div className={`max-w-md px-3 py-2 rounded-lg text-sm ${msg.sender === 'user' ? 'bg-primary/10 dark:bg-primary/20 text-dark dark:text-light' : 'bg-gray-200 dark:bg-gray-600 text-dark dark:text-light'}`}>
                                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                                    </div>
                                                    {msg.sender === 'user' && <UserIcon className="w-6 h-6 flex-shrink-0 bg-primary/10 text-primary rounded-full p-0.5" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Configuración de Bots</h2>
      </div>

      {!isDetailsVisible ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Card for Web Assistant */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col gap-4 transition-all duration-300 ease-in-out hover:shadow-2xl hover:ring-2 hover:ring-primary/50">
              <div className="flex items-center gap-4">
                  <BotIcon className="w-12 h-12 text-primary flex-shrink-0" />
                  <div>
                      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Asistente de IA "Slice"</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Activa o desactiva el asistente de chat en la página web.
                      </p>
                  </div>
              </div>
              <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          <span className={`h-4 w-4 rounded-full ${sliceStatus === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                              {sliceStatus === 'active' ? 'Conectado' : 'Desconectado'}
                          </p>
                      </div>
                      <button onClick={refreshSliceStatus} disabled={isSliceChecking} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50" aria-label="Refrescar estado">
                          <RefreshIcon className={`w-5 h-5 ${isSliceChecking ? 'animate-spin' : ''}`} />
                      </button>
                  </div>
                  {sliceStatus === 'active' && sliceConnectionTime && (
                      <div className="text-sm text-center border-t dark:border-gray-600 pt-3">
                          <p className="text-gray-600 dark:text-gray-400">Tiempo de conexión:</p>
                          <div className="text-lg text-gray-800 dark:text-gray-200">
                              <UptimeTimer startTime={sliceConnectionTime} />
                          </div>
                      </div>
                  )}
                  <div className="text-xs text-center text-gray-400 dark:text-gray-500 border-t dark:border-gray-600 pt-2">
                      Última actualización: {sliceLastUpdate ? new Date(sliceLastUpdate).toLocaleString('es-AR') : 'Nunca'}
                  </div>
              </div>
              <div className="flex-grow"></div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
                   <button onClick={handleToggleSliceBot} className={`${sliceStatus === 'active' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-primary hover:bg-red-700'} text-white font-bold py-2 px-4 rounded-lg transition-colors flex-1`}>
                      {sliceStatus === 'active' ? 'Desconectar' : 'Conectar'}
                  </button>
                  <button onClick={() => setIsDetailsVisible(true)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex-1">
                      Ver Detalles
                  </button>
              </div>
          </div>

          {/* Card for WhatsApp Bot */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col gap-4 transition-all duration-300 ease-in-out hover:shadow-2xl hover:ring-2 hover:ring-primary/50">
               <div className="flex items-center gap-4">
                  <WhatsAppIcon className="w-12 h-12 text-green-500 flex-shrink-0" />
                  <div>
                      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Asistente de WhatsApp</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Conecta el bot para recibir pedidos por WhatsApp.</p>
                  </div>
              </div>
              {renderStatusDisplay()}
              <div className="flex-grow"></div>
               <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2 min-h-[40px]">
                   <div className="flex-1 flex justify-center items-center">
                        {renderStatusAndActions()}
                   </div>
              </div>
          </div>
          
          {/* Card for Telegram */}
          <div className="relative bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col justify-between opacity-60">
              <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full transform rotate-12">Próximamente</div>
              <div>
                  <div className="flex items-center gap-4">
                      <TelegramIcon className="w-12 h-12 text-blue-500 flex-shrink-0" />
                      <div>
                          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Asistente de Telegram</h3>
                          <p className="text-gray-500 dark:text-gray-400 mt-1">
                              Gestiona pedidos y reservas directamente desde Telegram.
                          </p>
                      </div>
                  </div>
              </div>
              <div className="mt-6 text-center">
                  <button 
                      disabled
                      className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg cursor-not-allowed"
                  >
                      Próximamente
                  </button>
              </div>
          </div>
          
          {/* Card for Instagram */}
          <div className="relative bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col justify-between opacity-60">
              <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full transform rotate-12">Próximamente</div>
              <div>
                  <div className="flex items-center gap-4">
                      <InstagramIcon className="w-12 h-12 flex-shrink-0" />
                      <div>
                          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Asistente de Instagram</h3>
                          <p className="text-gray-500 dark:text-gray-400 mt-1">
                              Atiende a tus clientes a través de mensajes directos de Instagram.
                          </p>
                      </div>
                  </div>
              </div>
              <div className="mt-6 text-center">
                  <button 
                      disabled
                      className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg cursor-not-allowed"
                  >
                      Próximamente
                  </button>
              </div>
          </div>

          {/* Card for Facebook Messenger */}
          <div className="relative bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col justify-between opacity-60">
              <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full transform rotate-12">Próximamente</div>
              <div>
                  <div className="flex items-center gap-4">
                      <FacebookMessengerIcon className="w-12 h-12 text-blue-600 flex-shrink-0" />
                      <div>
                          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Asistente de Messenger</h3>
                          <p className="text-gray-500 dark:text-gray-400 mt-1">
                              Integra un bot de pedidos en tu página de Facebook.
                          </p>
                      </div>
                  </div>
              </div>
              <div className="mt-6 text-center">
                  <button 
                      disabled
                      className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg cursor-not-allowed"
                  >
                      Próximamente
                  </button>
              </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 relative animate-fade-in">
            <button 
                onClick={() => setIsDetailsVisible(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Cerrar vista de detalles"
            >
                <CloseIcon className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Detalles del Asistente "Slice"
            </h2>
             <div className="text-gray-600 dark:text-gray-300 min-h-[50vh] flex flex-col justify-start border-t dark:border-gray-700 mt-4 pt-4">
                {renderSliceDetails()}
            </div>
        </div>
      )}
      <WhatsAppQRCodeModal isOpen={isQrModalOpen} onClose={handleCloseQrModal} qrCodeUrl={qrCodeUrl} />
    </div>
  );
};

export default BotsPanel;