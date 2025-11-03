import React from 'react';
import type { ChatHistorySession } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { UserIcon } from '../icons/UserIcon';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { MessageSender } from '../../types';

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatHistorySession | null;
}

const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ isOpen, onClose, session }) => {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Historial de Chat con: {session.id}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="flex-grow overflow-y-auto p-6 space-y-4">
          {session.messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === MessageSender.USER ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === MessageSender.BOT && <WhatsAppIcon className="w-8 h-8 flex-shrink-0 text-green-500" />}
              <div className={`max-w-md px-4 py-3 rounded-2xl ${
                msg.sender === MessageSender.USER
                ? 'bg-green-100 dark:bg-green-900/40 text-dark dark:text-light rounded-br-none'
                : 'bg-gray-100 dark:bg-gray-700 text-dark dark:text-light rounded-bl-none'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
              {msg.sender === MessageSender.USER && <UserIcon className="w-8 h-8 flex-shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full p-1" />}
            </div>
          ))}
        </div>
        <footer className="flex justify-end items-center p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
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

export default ChatHistoryModal;