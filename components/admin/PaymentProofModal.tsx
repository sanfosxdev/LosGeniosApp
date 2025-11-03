import React from 'react';
import { CloseIcon } from '../icons/CloseIcon';

interface PaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const PaymentProofModal: React.FC<PaymentProofModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <header className="absolute top-0 right-0 p-2 z-10">
          <button onClick={onClose} className="text-white bg-black/50 rounded-full p-1 hover:bg-black/80">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-2">
          <img src={imageUrl} alt="Comprobante de Pago" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-md" />
        </div>
      </div>
    </div>
  );
};

export default PaymentProofModal;
