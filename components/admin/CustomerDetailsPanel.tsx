import React from 'react';
import type { Customer, Order, Reservation } from '../../types';
import { OrderStatus, ReservationStatus, OrderType } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { UtensilsIcon } from '../icons/UtensilsIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { HomeIcon } from '../icons/HomeIcon';

interface CustomerDetailsPanelProps {
  customer: Customer;
  orders: Order[];
  reservations: Reservation[];
  onClose: () => void;
}

interface MetricCardProps {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, value, label, color }) => (
    <div className={`p-4 rounded-lg flex items-center gap-4 bg-opacity-10 ${color}`}>
        <div className={`p-3 rounded-full bg-opacity-20 ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        </div>
    </div>
);


const CustomerDetailsPanel: React.FC<CustomerDetailsPanelProps> = ({ customer, orders, reservations, onClose }) => {
    
    const totalOrders = orders.length;
    const totalReservations = reservations.length;
    const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED).length;
    const cancelledReservations = reservations.filter(r => r.status === ReservationStatus.CANCELLED || r.status === ReservationStatus.NO_SHOW).length;
    
    const dineInVisits = orders.filter(o => o.type === OrderType.DINE_IN && o.status === OrderStatus.COMPLETED_DINE_IN).length;
    const reservationVisits = reservations.filter(r => r.status === ReservationStatus.COMPLETED).length;
    const totalVisits = dineInVisits + reservationVisits;

    const metrics = [
        { icon: <PackageIcon className="w-8 h-8 text-blue-500" />, value: totalOrders, label: 'Pedidos Totales', color: 'bg-blue-500' },
        { icon: <CalendarIcon className="w-8 h-8 text-indigo-500" />, value: totalReservations, label: 'Reservas Totales', color: 'bg-indigo-500' },
        { icon: <UtensilsIcon className="w-8 h-8 text-green-500" />, value: totalVisits, label: 'Visitas al Local', color: 'bg-green-500' },
        { icon: <XCircleIcon className="w-8 h-8 text-red-500" />, value: cancelledOrders + cancelledReservations, label: 'Cancelaciones / Ausencias', color: 'bg-red-500' },
    ];
    
    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{customer.name}</h2>
                <button onClick={onClose} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </header>
            
            <section className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Información de Contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {customer.phone && (
                        <div className="flex items-center gap-2">
                            <PhoneIcon className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-800 dark:text-gray-300">{customer.phone}</span>
                        </div>
                    )}
                    {customer.email && (
                         <div className="flex items-center gap-2">
                            <MailIcon className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-800 dark:text-gray-300">{customer.email}</span>
                        </div>
                    )}
                     {customer.address && (
                         <div className="flex items-center gap-2">
                            <HomeIcon className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-800 dark:text-gray-300">{customer.address}</span>
                        </div>
                    )}
                </div>
            </section>
            
            <section>
                 <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Métricas del Cliente</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metrics.map(metric => (
                        <MetricCard key={metric.label} {...metric} />
                    ))}
                 </div>
            </section>
        </div>
    );
};

export default CustomerDetailsPanel;
