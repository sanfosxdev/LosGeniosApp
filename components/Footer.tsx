
import React from 'react';
import { PizzaIcon } from './icons/PizzaIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { TwitterIcon } from './icons/TwitterIcon';

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
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-secondary transition-colors">
            <FacebookIcon className="w-6 h-6" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-secondary transition-colors">
            <InstagramIcon className="w-6 h-6" />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-secondary transition-colors">
            <TwitterIcon className="w-6 h-6" />
          </a>
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
