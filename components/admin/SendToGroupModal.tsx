import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../icons/CloseIcon';
import { InfoIcon } from '../icons/InfoIcon';

interface SendToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (groupId: string, content: string, mediaUrl?: string) => void;
}

const SendToGroupModal: React.FC<SendToGroupModalProps> = ({ isOpen, onClose, onSend }) => {
    const [groupId, setGroupId] = useState('');
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setGroupId('');
            setContent('');
            setMediaUrl('');
            setError(null);
        }
    }, [isOpen]);
    
    const handleGroupIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const match = value.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
        if (match && match[1]) {
            setGroupId(match[1]);
        } else {
            setGroupId(value);
        }
    };

    const handleSend = () => {
        if (!groupId.trim() || !content.trim()) {
            setError('El ID del grupo y el mensaje son obligatorios.');
            return;
        }
        onSend(groupId, content, mediaUrl);
    };

    if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Enviar Mensaje a Grupo de WhatsApp</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 space-y-4 overflow-y-auto">
            <div>
                <label htmlFor="groupId" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ID del Grupo o Enlace de Invitación
                    <div className="relative group ml-2">
                        <InfoIcon className="w-4 h-4 text-gray-400 cursor-pointer" />
                        <div className="absolute hidden group-hover:block bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-2 text-xs text-white bg-gray-700 rounded-lg shadow-lg z-10">
                            Pega el enlace de invitación (ej: https://chat.whatsapp.com/GTCIzU6...) o solo el ID del grupo.
                            <br/><br/>
                            <strong className="text-yellow-300">Importante:</strong> El número de teléfono del bot debe ser miembro del grupo para que el envío funcione.
                        </div>
                    </div>
                </label>
                <input id="groupId" type="text" value={groupId} onChange={handleGroupIdChange} placeholder="GTCIzU6RfXBEvalvi0LrcC" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
            </div>
            
            <div>
                <label htmlFor="group-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
                <textarea id="group-content" value={content} onChange={e => setContent(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Puedes usar *texto en negrita* y _texto en cursiva_.</p>
            </div>
             <div>
                <label htmlFor="group-mediaUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de Imagen (Opcional)</label>
                <input id="group-mediaUrl" type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.png" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
            </div>
             {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          <div className="space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!groupId.trim() || !content.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Enviar a Grupo
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SendToGroupModal;