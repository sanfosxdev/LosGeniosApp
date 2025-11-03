import React from 'react';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

interface FloatingChatButtonProps {
  onClick: () => void;
  isBotActive: boolean;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick, isBotActive }) => {
  if (!isBotActive) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-dark animate-pulse-mic z-40"
      aria-label="Abrir asistente de IA"
    >
      <MicrophoneIcon className="w-8 h-8" />
    </button>
  );
};

export default FloatingChatButton;
