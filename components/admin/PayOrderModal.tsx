import React, { useState } from 'react';
import { PaymentMethod } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';

interface PayOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, paymentProofUrl?: string) => void;
  totalAmount: number;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

const PayOrderModal: React.FC<PayOrderModalProps> = ({ isOpen, onClose, onConfirm, totalAmount }) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleConfirm = async () => {
    let proofUrl: string | undefined = undefined;
    if (paymentProofFile) {
        proofUrl = await fileToDataUrl(paymentProofFile);
    }
    onConfirm(paymentMethod, proofUrl);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Confirmar Pago de la Mesa</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 space-y-4">
            <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-400 font-semibold">Total a Pagar:</p>
                <p className="text-3xl font-bold text-primary">${totalAmount.toLocaleString('es-AR')}</p>
            </div>
          
            <fieldset>
                <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200 mb-2">Forma de Pago</legend>
                <div className="mt-2 text-gray-800 dark:text-gray-200 space-y-2">
                    {Object.values(PaymentMethod).map(method => (
                         <label key={method} className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 has-[:checked]:bg-primary/10 has-[:checked]:ring-2 has-[:checked]:ring-primary">
                            <input 
                                type="radio" 
                                name="paymentMethod" 
                                value={method} 
                                checked={paymentMethod === method} 
                                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"
                            />
                            {method}
                        </label>
                    ))}
                </div>
            </fieldset>

            {paymentMethod === 'Transferencia' && (
                <div className="mt-4 p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 animate-fade-in rounded-r-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">Datos para la Transferencia</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        <strong>CBU:</strong> 1234567890123456789012<br/>
                        <strong>Alias:</strong> PIZZERIA.LOS.GENIOS
                    </p>
                    <div className="mt-3">
                        <label htmlFor="paymentProof" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subir Comprobante (Opcional)</label>
                        <input type="file" id="paymentProof" onChange={handleFileChange} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                    </div>
                </div>
            )}
        </div>
        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Confirmar Pago
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PayOrderModal;