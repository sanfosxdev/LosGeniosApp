import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { CloseIcon } from '../icons/CloseIcon';
import type { Table } from '../../types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, table }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && table && canvasRef.current) {
      const url = `${window.location.origin}?tableId=${table.id}`;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'H'
      }, (error) => {
        if (error) console.error(error);
      });
    }
  }, [isOpen, table]);
  
  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if(printWindow) {
        printWindow.document.write('<html><head><title>Imprimir QR</title>');
        printWindow.document.write('<style>body { text-align: center; font-family: sans-serif; } h1 { font-size: 2rem; } canvas { width: 80% !important; height: auto !important; } </style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(`<h1>Mesa: ${table?.name}</h1>`);
        printWindow.document.write('<canvas id="qr-print"></canvas>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        const printCanvas = printWindow.document.getElementById('qr-print') as HTMLCanvasElement;
        const url = `${window.location.origin}?tableId=${table?.id}`;
        QRCode.toCanvas(printCanvas, url, { width: 500, margin: 2, errorCorrectionLevel: 'H' }, (error) => {
             if (error) console.error(error);
             printWindow.print();
             printWindow.close();
        });
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Código QR para {table?.name}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 text-center">
            <canvas ref={canvasRef} className="mx-auto border dark:border-gray-700 rounded-lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">
                Escanea este código para acceder al menú y hacer tu pedido desde la mesa.
            </p>
        </div>
        <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700"
          >
            Imprimir
          </button>
        </footer>
      </div>
    </div>
  );
};

export default QRCodeModal;
