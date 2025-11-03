
import React from 'react';
import { PizzaIcon } from './icons/PizzaIcon';

interface FooterProps {
  onAdminClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onAdminClick }) => {
  return (
    <footer className="bg-dark text-white py-12">
      <div className="container mx-auto px-6 text-center">
        <div className="flex justify-center items-center space-x-2 mb-4">
          <PizzaIcon className="w-8 h-8 text-secondary" />
          <h3 className="text-2xl font-bold font-display">Pizzería Los Genios</h3>
        </div>
        <p className="mb-4">Calle de la Pizza 123, Reactville, TS 54321</p>
        <p className="mb-6">© {new Date().getFullYear()} Pizzería Los Genios. Todos los derechos reservados.</p>
        <div className="flex justify-center space-x-6">
          <a href="#" className="hover:text-secondary transition-colors">Facebook</a>
          <a href="#" className="hover:text-secondary transition-colors">Instagram</a>
          <a href="#" className="hover:text-secondary transition-colors">Twitter</a>
        </div>
         <div className="mt-6 pt-6 border-t border-gray-700">
          <button onClick={onAdminClick} className="text-sm text-gray-400 hover:text-white">
            Panel de Administración
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
