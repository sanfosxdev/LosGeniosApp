import React, { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { SendIcon } from './icons/SendIcon';
import { CloseIcon } from './icons/CloseIcon';
import { UserIcon } from './icons/UserIcon';
import { BotIcon } from './icons/BotIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { UploadCloudIcon } from './icons/UploadCloudIcon';
import type { ChatMessage } from '../types';
import { MessageSender, CreatedBy } from '../types';
import { createChatSession, transcribeAudio, type CustomChat } from '../services/geminiService';
import { saveOrder } from '../services/orderService';
import { addReservation, findAvailableTables, getAvailability } from '../services/reservationService';
import { isBusinessOpen } from '../services/scheduleService';
import * as sliceBotMetricsService from '../services/sliceBotMetricsService';

interface ChatAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHAT_MESSAGES_KEY = 'pizzeria-slice-chat-messages';
const CHAT_ACTION_LOCK_KEY = 'pizzeria-slice-chat-action-lock';
const CHAT_SESSION_ID_KEY = 'pizzeria-slice-chat-session-id';
const CHAT_SESSION_COMPLETED_KEY = 'pizzeria-slice-chat-session-completed';

const ChatAssistantModal: React.FC<ChatAssistantModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [actionLock, setActionLock] = useState<'order' | 'reservation' | null>(null);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  
  const chatRef = useRef<CustomChat | null>(null);
  const sessionRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const dragCounter = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Persist state to localStorage
  useEffect(() => {
    if (messages.length > 0) { // Persist even from the first message
      localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages));
    } else {
      localStorage.removeItem(CHAT_MESSAGES_KEY);
    }
  }, [messages]);

  useEffect(() => {
    if (actionLock) {
      localStorage.setItem(CHAT_ACTION_LOCK_KEY, JSON.stringify(actionLock));
    } else {
      localStorage.removeItem(CHAT_ACTION_LOCK_KEY);
    }
  }, [actionLock]);
  
  useEffect(() => {
    if (isSessionCompleted) {
        localStorage.setItem(CHAT_SESSION_COMPLETED_KEY, 'true');
    } else {
        localStorage.removeItem(CHAT_SESSION_COMPLETED_KEY);
    }
  }, [isSessionCompleted]);


  const resetChat = useCallback((showGreeting = true) => {
    localStorage.removeItem(CHAT_MESSAGES_KEY);
    localStorage.removeItem(CHAT_ACTION_LOCK_KEY);
    localStorage.removeItem(CHAT_SESSION_ID_KEY);
    localStorage.removeItem(CHAT_SESSION_COMPLETED_KEY);
    setActionLock(null);
    setIsSessionCompleted(false);
    chatRef.current = null;
    sessionRef.current = null;

    if (showGreeting) {
        setIsLoading(true);
        try {
            sessionRef.current = sliceBotMetricsService.startSession();
            localStorage.setItem(CHAT_SESSION_ID_KEY, sessionRef.current);
            chatRef.current = createChatSession();
            const initialMessageText = isBusinessOpen()
                ? '¡Bienvenido a Pizzería Los Genios! Soy Slice, tu asistente virtual. ¿Te gustaría hacer un pedido o una reserva?'
                : '¡Hola! Bienvenido a Pizzería Los Genios. Actualmente estamos cerrados para pedidos, pero puedo ayudarte a hacer una reserva para cuando abramos. ¿Te gustaría?';
            
            const botMessage: ChatMessage = { sender: MessageSender.BOT, text: initialMessageText };
            setMessages([botMessage]);
            if (sessionRef.current) {
                sliceBotMetricsService.logMessage(sessionRef.current, botMessage);
            }
        } catch (error) {
            console.error("Failed to re-initialize chat:", error);
            setMessages([{ sender: MessageSender.BOT, text: "Lo siento, tengo problemas para conectarme. Por favor, inténtalo de nuevo más tarde." }]);
        } finally {
            setIsLoading(false);
        }
    } else {
        setMessages([]);
    }
  }, []);

  const initializeChat = useCallback(async () => {
    if (isOpen) {
      setIsLoading(true);
      try {
        const storedMessagesJson = localStorage.getItem(CHAT_MESSAGES_KEY);
        const storedLockJson = localStorage.getItem(CHAT_ACTION_LOCK_KEY);
        const storedSessionId = localStorage.getItem(CHAT_SESSION_ID_KEY);
        const storedSessionCompleted = localStorage.getItem(CHAT_SESSION_COMPLETED_KEY);
        
        const loadedMessages = storedMessagesJson ? JSON.parse(storedMessagesJson) : [];
        const loadedLock = storedLockJson ? JSON.parse(storedLockJson) : null;
        sessionRef.current = storedSessionId;
        const loadedCompleted = storedSessionCompleted === 'true';

        if (loadedMessages.length > 0 && sessionRef.current) {
          setMessages(loadedMessages);
          setActionLock(loadedLock);
          setIsSessionCompleted(loadedCompleted);
          chatRef.current = createChatSession(loadedMessages, loadedLock);
        } else {
          resetChat(true);
        }
      } catch (error) {
        console.error("Failed to initialize or load chat:", error);
        resetChat(true);
      } finally {
        setIsLoading(false);
      }
    } else if (isRecording) {
      stopRecording();
    }
  }, [isOpen, isRecording, resetChat]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
        initializeChat();
    }
  }, [isOpen, messages.length, initializeChat]);

  const handleActionSuccess = useCallback((confirmationText: string) => {
      const confirmationMessage: ChatMessage = {
          sender: MessageSender.BOT,
          text: confirmationText
      };
      setMessages(prev => [...prev, confirmationMessage]);
      if(sessionRef.current) {
        sliceBotMetricsService.logMessage(sessionRef.current, confirmationMessage);
      }
      
      setIsSessionCompleted(true);
      setActionLock(null);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatRef.current || isSessionCompleted) return;

    if (!sessionRef.current) {
        console.error("Chat session is missing. Resetting chat.");
        resetChat(true);
        return;
    }
    const sessionId = sessionRef.current;
    
    const userMessage: ChatMessage = { sender: MessageSender.USER, text };
    
    let newActionLock = actionLock;
    // This is the first user message of a new session
    if (!actionLock && messages.length === 1) { 
        const userText = text.toLowerCase();
        if (userText.includes('pedido') || userText.includes('ordenar') || userText.includes('pizza') || userText.includes('comprar')) {
            newActionLock = 'order';
        } else if (userText.includes('reserva') || userText.includes('mesa') || userText.includes('lugar')) {
            newActionLock = 'reservation';
        }
        if(newActionLock) {
            setActionLock(newActionLock);
            // Re-create chat session with the lock for the new system prompt
            chatRef.current = createChatSession([...messages, userMessage], newActionLock);
        }
    }
    
    setMessages(prev => [...prev, userMessage]);
    sliceBotMetricsService.logMessage(sessionId, userMessage);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const botResponseText = response.text;

      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = botResponseText.match(jsonRegex);

      if (match && match[1]) {
        setIsLoading(false);
        try {
            const data = JSON.parse(match[1]);

            if (data.intent === 'ORDER') {
                saveOrder({ ...data, createdBy: CreatedBy.WEB_ASSISTANT });
                if (sessionId) sliceBotMetricsService.logOutcome(sessionId, 'order');
                handleActionSuccess(`¡Perfecto! Tu pedido ha sido registrado con éxito. ¡Gracias por elegir Pizzería Los Genios!`);
            } else if (data.intent === 'RESERVATION') {
                setIsLoading(true);
                const { customerName, customerPhone, guests, date, time } = data;
                const reservationTime = new Date(`${date}T${time}`);

                if (isNaN(reservationTime.getTime())) {
                    const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "La fecha u hora proporcionada no es válida. ¿Podrías intentarlo de nuevo?" };
                    setMessages(prev => [...prev, errorMessage]);
                    if (sessionId) sliceBotMetricsService.logMessage(sessionId, errorMessage);
                    setIsLoading(false);
                    return;
                }

                const availableTableIds = findAvailableTables(reservationTime, guests);

                if (availableTableIds) {
                    addReservation({
                        customerName,
                        customerPhone,
                        guests,
                        reservationTime: reservationTime.toISOString(),
                        tableIds: availableTableIds,
                        notes: 'Reservado via Asistente IA',
                        createdBy: CreatedBy.WEB_ASSISTANT,
                    });
                    if (sessionId) sliceBotMetricsService.logOutcome(sessionId, 'reservation');
                    handleActionSuccess(`¡Excelente! Tu reserva para ${guests} personas el ${new Date(reservationTime).toLocaleDateString('es-AR')} a las ${time} ha sido confirmada. ¡Te esperamos!`);
                } else {
                    const dateObj = new Date(date + 'T00:00:00');
                    const alternativeSlots = getAvailability(dateObj, guests)
                        .filter(slot => slot > time)
                        .slice(0, 3);

                    let suggestionText = `Lo siento, el horario de las ${time} ya no está disponible para ${guests} personas.`;
                    if (alternativeSlots.length > 0) {
                        suggestionText += ` ¿Te gustaría reservar en alguno de estos horarios cercanos? ${alternativeSlots.join(', ')}.`;
                    } else {
                        suggestionText += ` No hay otros turnos disponibles para ese día con esa cantidad de comensales. ¿Quieres intentar otro día?`;
                    }
                    const suggestionMessage: ChatMessage = { sender: MessageSender.BOT, text: suggestionText };
                    setMessages(prev => [...prev, suggestionMessage]);
                     if (sessionId) sliceBotMetricsService.logMessage(sessionId, suggestionMessage);
                }
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Failed to parse or process bot response JSON:", error);
            const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Hubo un problema al procesar tu solicitud. Por favor, intenta de nuevo." };
            setMessages(prev => [...prev, errorMessage]);
            if(sessionId) sliceBotMetricsService.logMessage(sessionId, errorMessage);
        }

      } else {
        const thinkTime = 300 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, thinkTime));
        
        const botMessage: ChatMessage = { sender: MessageSender.BOT, text: botResponseText };
        
        setIsLoading(false);
        setMessages(prev => [...prev, botMessage]);
        sliceBotMetricsService.logMessage(sessionId, botMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessageText = error instanceof Error ? error.message : "¡Vaya! Algo salió mal. Por favor, inténtalo de nuevo.";
      const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: errorMessageText };
      setMessages(prev => [...prev, errorMessage]);
      if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
      setIsLoading(false);
    }
  }, [messages, actionLock, handleActionSuccess, resetChat, isSessionCompleted]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !input.trim()) return;
    const textToSend = input;
    setInput('');
    await handleSendMessage(textToSend);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.substring(base64data.indexOf(',') + 1));
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsLoading(true);
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const transcribedText = await transcribeAudio(base64Audio, 'audio/webm');
          if (transcribedText) {
            await handleSendMessage(transcribedText);
          } else {
            const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Lo siento, no pude entender eso. Por favor, inténtalo de nuevo." };
            setMessages(prev => [...prev, errorMessage]);
            if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
          }
        } catch (error) {
          console.error("Error during transcription or sending:", error);
          const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Hubo un error al procesar tu mensaje de voz. Por favor, inténtalo de nuevo." };
          setMessages(prev => [...prev, errorMessage]);
          if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "No puedo acceder a tu micrófono. Por favor, revisa los permisos de tu navegador." };
      setMessages(prev => [...prev, errorMessage]);
      if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleMicrophoneClick = () => {
    if ((isLoading && !isRecording) || isSessionCompleted) return;
    isRecording ? stopRecording() : startRecording();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      e.dataTransfer.clearData();

      if (!file.type.startsWith('audio/')) {
        const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Por favor, suelta un archivo de audio válido." };
        setMessages(prev => [...prev, errorMessage]);
        if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
        return;
      }

      setIsLoading(true);
      try {
        const base64Audio = await blobToBase64(file);
        const transcribedText = await transcribeAudio(base64Audio, file.type);
        if (transcribedText) {
          await handleSendMessage(transcribedText);
        } else {
           const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Lo siento, no pude entender el audio. ¿Podrías intentarlo de nuevo?" };
           setMessages(prev => [...prev, errorMessage]);
           if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
        }
      } catch (error) {
        console.error("Error processing dropped file:", error);
        const errorMessage: ChatMessage = { sender: MessageSender.BOT, text: "Hubo un error al procesar tu archivo de audio. Por favor, inténtalo de nuevo." };
        setMessages(prev => [...prev, errorMessage]);
        if(sessionRef.current) sliceBotMetricsService.logMessage(sessionRef.current, errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  }, [handleSendMessage]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg h-[90vh] md:h-[80vh] flex flex-col transform animate-slide-in-up">
        <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold font-display text-dark dark:text-light">Slice - Tu Asistente de Pizza IA</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === MessageSender.USER ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === MessageSender.BOT && <BotIcon className="w-8 h-8 flex-shrink-0 text-primary" />}
              <div className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl ${
                msg.sender === MessageSender.USER 
                ? 'bg-primary text-white rounded-br-none animate-fade-in' 
                : 'bg-gray-100 dark:bg-gray-700 text-dark dark:text-light rounded-bl-none animate-slide-in-up'
              }`}>
                {msg.sender === MessageSender.BOT ? (
                  <div
                    className="bot-message-content"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.text, { breaks: true }) as string }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
               {msg.sender === MessageSender.USER && <UserIcon className="w-8 h-8 flex-shrink-0 bg-primary text-white rounded-full p-1" />}
            </div>
          ))}
          {isLoading && !isRecording && (
             <div className="flex items-start gap-3 justify-start animate-slide-in-up">
               <BotIcon className="w-8 h-8 flex-shrink-0 text-primary" />
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-2">
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 border-t border-gray-200 dark:border-gray-700">
            {isSessionCompleted && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                Esta conversación ha finalizado.
                </div>
            )}
          <form onSubmit={handleFormSubmit} className="flex items-center space-x-3">
            {isRecording ? (
                <div className="flex-1 flex items-center justify-center text-gray-600 dark:text-gray-400 italic">
                    Escuchando...
                </div>
            ) : (
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe o usa el micrófono..."
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-dark dark:text-light placeholder-gray-500 dark:placeholder-gray-400 border-transparent focus:ring-primary focus:border-primary rounded-full py-3 px-5 outline-none disabled:opacity-50"
                  disabled={isLoading || isSessionCompleted}
                />
            )}
             <button
                type="button"
                onClick={handleMicrophoneClick}
                disabled={(isLoading && !isRecording) || isSessionCompleted}
                className={`p-3 rounded-full text-white transition-colors flex-shrink-0 ${isRecording ? 'bg-primary animate-pulse-mic' : 'bg-gray-500 hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
            >
                <MicrophoneIcon className="w-6 h-6" />
            </button>
            {!isRecording && (
                <button type="submit" disabled={isLoading || !input.trim() || isSessionCompleted} className="bg-primary text-white rounded-full p-3 disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-red-700 transition-colors">
                  <SendIcon className="w-6 h-6" />
                </button>
            )}
          </form>
           <div className="text-center mt-2 px-4">
            <button 
              onClick={() => resetChat(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline focus:outline-none"
            >
              Empezar de nuevo
            </button>
          </div>
        </footer>
         {isDragOver && (
            <div className="absolute inset-0 bg-primary/90 flex flex-col justify-center items-center rounded-2xl border-4 border-dashed border-white z-10 transition-opacity duration-300">
                <UploadCloudIcon className="w-20 h-20 text-white animate-bounce" />
                <p className="mt-4 text-2xl font-bold text-white">Suelta tu archivo de audio</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default ChatAssistantModal;