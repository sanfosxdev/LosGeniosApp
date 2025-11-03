import React, { useState } from 'react';
import { PizzaIcon } from './icons/PizzaIcon';
import { MenuIcon } from './icons/MenuIcon';
import { CloseIcon } from './icons/CloseIcon';
import ThemeToggleButton from './ThemeToggleButton';

interface HeaderProps {
  onOrderClick: () => void;
  onAdminClick: () => void;
  isBotActive: boolean;
  isStoreOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onOrderClick, onAdminClick, isBotActive, isStoreOpen }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = (
    <>
      <a href="#home" className="block py-2 md:py-0 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>Inicio</a>
      <a href="#menu" className="block py-2 md:py-0 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>Menú</a>
      <a href="#about" className="block py-2 md:py-0 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>Nosotros</a>
      <button onClick={() => { onAdminClick(); setIsMenuOpen(false); }} className="block py-2 md:py-0 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors duration-300 text-left">
        Admin
      </button>
    </>
  );

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <PizzaIcon className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold font-display text-dark dark:text-light">Pizzería Los Genios</h1>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks}
        </nav>

        <div className="flex items-center">
            {isBotActive && (
              <button
                  onClick={onOrderClick}
                  className="bg-primary text-white font-bold py-2 px-6 rounded-full hover:bg-red-700 transition-transform duration-300 ease-in-out transform hover:scale-105"
              >
                  {isStoreOpen ? 'Pedir Online' : 'Reservar Online'}
              </button>
            )}
            <div className="ml-4">
              <ThemeToggleButton />
            </div>
             {/* Mobile Menu Button */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="ml-4 md:hidden text-dark dark:text-light z-50">
                {isMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-gray-800 shadow-lg animate-fade-in">
            <nav className="flex flex-col px-6 py-4 space-y-2">
                {navLinks}
            </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
