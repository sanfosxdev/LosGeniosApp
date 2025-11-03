import React from 'react';
import { PizzaIcon } from '../icons/PizzaIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { ShoppingBagIcon } from '../icons/ShoppingBagIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { LayoutGridIcon } from '../icons/LayoutGridIcon';
import { BotIcon } from '../icons/BotIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import ThemeToggleButton from '../ThemeToggleButton';

type AdminPanel = 'orders' | 'products' | 'customers' | 'schedule' | 'reservations' | 'tables' | 'bots' | 'settings';

interface AdminSidebarProps {
  activePanel: AdminPanel;
  onPanelChange: (panel: AdminPanel) => void;
  onGoToSite: () => void;
  isSidebarOpen: boolean;
  onSidebarClose: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePanel, onPanelChange, onGoToSite, isSidebarOpen, onSidebarClose }) => {
    const navItems = [
        { id: 'orders', label: 'Pedidos', icon: <PackageIcon className="w-6 h-6" /> },
        { id: 'reservations', label: 'Reservas', icon: <CalendarIcon className="w-6 h-6" /> },
        { id: 'tables', label: 'Mesas', icon: <LayoutGridIcon className="w-6 h-6" /> },
        { id: 'products', label: 'Productos', icon: <ShoppingBagIcon className="w-6 h-6" /> },
        { id: 'customers', label: 'Clientes', icon: <UsersIcon className="w-6 h-6" /> },
        { id: 'schedule', label: 'Horarios', icon: <ClockIcon className="w-6 h-6" /> },
        { id: 'bots', label: 'Bots', icon: <BotIcon className="w-6 h-6" /> },
        { id: 'settings', label: 'Ajustes', icon: <SettingsIcon className="w-6 h-6" /> },
    ];

    const baseClasses = "flex items-center w-full px-4 py-3 transition-colors duration-200 rounded-lg";
    const activeClasses = "bg-primary text-white";
    const inactiveClasses = "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700";
    
    const handlePanelChange = (panel: AdminPanel) => {
        onPanelChange(panel);
        onSidebarClose(); // Close sidebar on selection in mobile
    }

    return (
        <>
            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={onSidebarClose}
                ></div>
            )}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex-shrink-0`}>
                <div className="h-20 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 lg:border-b-0">
                    <div className="flex items-center space-x-2">
                        <PizzaIcon className="w-8 h-8 text-primary" />
                        <span className="text-xl font-bold font-display text-dark dark:text-light">Panel Admin</span>
                    </div>
                </div>
                <nav className="flex-grow mt-6 space-y-2 overflow-y-auto">
                    {navItems.map(item => (
                         <button
                            key={item.id}
                            onClick={() => handlePanelChange(item.id as AdminPanel)}
                            className={`${baseClasses} ${activePanel === item.id ? activeClasses : inactiveClasses}`}
                        >
                            {item.icon}
                            <span className="ml-4 font-semibold">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4 space-y-4">
                     <div className="flex justify-between items-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                         <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">Tema</span>
                         <ThemeToggleButton />
                     </div>
                     <button
                        onClick={onGoToSite}
                        className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Volver al Sitio
                    </button>
                </div>
            </aside>
        </>
    );
};

export default AdminSidebar;