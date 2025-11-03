import React, { useState, useEffect, useCallback, Fragment, useMemo } from 'react';
import { getOrdersFromCache as getOrders, updateOrderStatus, saveOrder, updateOrder, deleteOrder, markOrderAsPaid, isOrderFinished } from '../../services/orderService';
import { getTablesFromCache as getTables } from '../../services/tableService';
import { updateReservationStatus } from '../../services/reservationService';
import { isBusinessOpen } from '../../services/scheduleService';
import type { Order, Table } from '../../types';
import { OrderStatus, OrderType, PaymentMethod, ReservationStatus, ReservationCancellationReason, CreatedBy } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ChevronUpIcon } from '../icons/ChevronUpIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UtensilsIcon } from '../icons/UtensilsIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { CloseIcon } from '../icons/CloseIcon';
import AddOrderModal from './AddOrderModal';
import DeleteOrderConfirmationModal from './DeleteOrderConfirmationModal';
import StatusTimer from './StatusTimer';
import Pagination from './Pagination';
import PaymentProofModal from './PaymentProofModal';
import OrderDetailsModal from './OrderDetailsModal';
import { DownloadIcon } from '../icons/DownloadIcon';
import ExportOrdersModal from './ExportOrdersModal';
import { toastService } from '../../services/toastService';
import { Spinner } from './Spinner';

const ITEMS_PER_PAGE = 10;

interface OrdersPanelProps {
  onRefreshNotifications: () => void;
  dataTimestamp: number;
}

const getNextValidStatuses = (order: Order): OrderStatus[] => {
    const { status, type, isPaid } = order;
    switch (status) {
        case OrderStatus.PENDING:
            return [OrderStatus.CONFIRMED, OrderStatus.CANCELLED];
        case OrderStatus.CONFIRMED:
            if (type === OrderType.DELIVERY && !isPaid) {
                 return [OrderStatus.CANCELLED]; // Cannot move to PREPARING if delivery is unpaid
            }
            return [OrderStatus.PREPARING, OrderStatus.CANCELLED];
        case OrderStatus.PREPARING:
            return [OrderStatus.READY, OrderStatus.CANCELLED];
        case OrderStatus.READY:
            switch(type) {
                case OrderType.PICKUP: return [OrderStatus.COMPLETED_PICKUP];
                case OrderType.DELIVERY: return [OrderStatus.DELIVERING];
                case OrderType.DINE_IN:
                    return isPaid
                        ? [OrderStatus.COMPLETED_DINE_IN]
                        : [OrderStatus.DINE_IN_PENDING_PAYMENT];
                default: return [];
            }
        case OrderStatus.DELIVERING:
            return [OrderStatus.COMPLETED_DELIVERY];
        case OrderStatus.DINE_IN_PENDING_PAYMENT:
             // Can only be completed once it's paid
            return isPaid ? [OrderStatus.COMPLETED_DINE_IN, OrderStatus.CANCELLED] : [OrderStatus.CANCELLED];
        default:
            return []; // No transitions from finished states
    }
};

const getStatusColor = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
        case OrderStatus.CONFIRMED: return 'bg-blue-100 text-blue-800';
        case OrderStatus.PREPARING: return 'bg-indigo-100 text-indigo-800';
        case OrderStatus.READY: return 'bg-purple-100 text-purple-800';
        case OrderStatus.DELIVERING: return 'bg-teal-100 text-teal-800';
        case OrderStatus.DINE_IN_PENDING_PAYMENT: return 'bg-orange-100 text-orange-800';
        case OrderStatus.COMPLETED_PICKUP:
        case OrderStatus.COMPLETED_DELIVERY:
        case OrderStatus.COMPLETED_DINE_IN:
            return 'bg-green-100 text-green-800';
        case OrderStatus.CANCELLED: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getStatusBorderColor = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.PENDING: return 'border-yellow-400';
        case OrderStatus.CONFIRMED: return 'border-blue-400';
        case OrderStatus.PREPARING: return 'border-indigo-400';
        case OrderStatus.READY: return 'border-purple-400';
        case OrderStatus.DELIVERING: return 'border-teal-400';
        case OrderStatus.DINE_IN_PENDING_PAYMENT: return 'border-orange-400';
        default: return 'border-gray-300 dark:border-gray-600';
    }
};

// Order Card for Kanban Board
const OrderCard: React.FC<{
    order: Order;
    tables: Table[];
    onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
    onEdit: (order: Order) => void;
    onDelete: (order: Order) => void;
    onViewDetails: (order: Order) => void;
    onMarkAsPaid: (order: Order) => void;
    onViewProof: (url: string) => void;
    loadingAction: { type: string, id: string } | null;
}> = ({ order, tables, onStatusChange, onEdit, onDelete, onViewDetails, onMarkAsPaid, onViewProof, loadingAction }) => {
    const nextStatuses = getNextValidStatuses(order);
    const currentStatusInfo = order.statusHistory[order.statusHistory.length - 1];
    const isLoadingStatus = loadingAction?.type === 'status' && loadingAction?.id === order.id;
    const isLoadingPayment = loadingAction?.type === 'payment' && loadingAction?.id === order.id;

    const getOrderTypeInfo = () => {
        switch(order.type) {
            case OrderType.DELIVERY:
                return { text: 'Delivery', color: 'bg-teal-100 text-teal-800' };
            case OrderType.PICKUP:
                return { text: 'Retiro', color: 'bg-purple-100 text-purple-800' };
            case OrderType.DINE_IN:
                const tableNames = order.tableIds?.map(id => tables.find(t => t.id === id)?.name || '?').join(', ') || 'N/A';
                return { text: tableNames, color: 'bg-orange-100 text-orange-800' };
            default:
                return { text: 'N/A', color: 'bg-gray-100 text-gray-800' };
        }
    };
    const orderTypeInfo = getOrderTypeInfo();

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-3 border-l-4 ${getStatusBorderColor(order.status)} animate-fade-in max-w-sm`}>
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-2">
                <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100">#{order.id.split('-')[1]}</h4>
                <span className={`px-2 py-1 text-sm font-semibold rounded-full ${orderTypeInfo.color}`}>
                    {orderTypeInfo.text}
                </span>
            </div>
            
            <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                <div>
                    <p className="font-semibold text-base text-gray-700 dark:text-gray-300">{order.customer.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{order.customer.phone}</p>
                </div>
            </div>

            <ul className="text-base text-gray-600 dark:text-gray-400 space-y-1">
                {order.items.map((item, index) => (
                    <li key={index} className="flex justify-between">
                        <span>{item.isPromotion ? '🎁' : ''} {item.quantity}x {item.name}</span>
                        <span>${(item.price * item.quantity).toLocaleString('es-AR')}</span>
                    </li>
                ))}
            </ul>
            
            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 mt-2">
                <p className="font-bold text-lg text-primary">${order.total.toLocaleString('es-AR')}</p>
                {currentStatusInfo && <StatusTimer startDate={currentStatusInfo.startedAt} />}
            </div>

            <div className="pt-2 border-t dark:border-gray-700 mt-2 space-y-2">
                <div className="flex justify-between items-center text-base">
                    <span className="font-semibold text-gray-600 dark:text-gray-300">Pago ({order.paymentMethod}):</span>
                    <div className={`px-2 py-1 rounded-full text-sm font-bold ${order.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {order.isPaid ? 'Aprobado' : 'Pendiente'}
                    </div>
                </div>
                {order.paymentProofUrl && (
                    <button onClick={() => onViewProof(order.paymentProofUrl!)} className="w-full text-left text-base text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                        Ver Comprobante
                    </button>
                )}
                {!order.isPaid && (
                     <button 
                        onClick={() => onMarkAsPaid(order)} 
                        disabled={isLoadingPayment}
                        className="w-full mt-1 flex items-center justify-center bg-green-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
                     >
                        {isLoadingPayment ? <Spinner /> : <CheckCircleIcon className="w-4 h-4 mr-2" />}
                        {isLoadingPayment ? 'Aprobando...' : 'Aprobar Pago'}
                    </button>
                )}
            </div>

            <div className="flex gap-2 items-center mt-3 pt-3 border-t dark:border-gray-700">
                {isLoadingStatus ? (
                    <div className="flex-grow flex justify-center items-center h-[38px] bg-gray-100 dark:bg-gray-700 rounded-full">
                        <Spinner color="border-primary" />
                    </div>
                ) : (
                    <select
                        value={order.status}
                        onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={nextStatuses.length === 0}
                        className={`flex-grow appearance-none px-3 py-2 text-sm leading-5 font-semibold rounded-full border-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 ${getStatusColor(order.status)}`}
                    >
                        <option value={order.status}>{order.status}</option>
                        {nextStatuses.map(status => (
                            <option key={status} value={status}>
                               &#8618; {status}
                            </option>
                        ))}
                    </select>
                )}
                <button onClick={() => onViewDetails(order)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" aria-label="Ver detalles"><InfoIcon className="w-5 h-5"/></button>
                {(order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED) && (
                    <button onClick={() => onEdit(order)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-700 rounded-full" aria-label="Editar"><EditIcon className="w-5 h-5"/></button>
                )}
                <button onClick={() => onDelete(order)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full" aria-label="Eliminar"><TrashIcon className="w-5 h-5"/></button>
            </div>
        </div>
    );
};


const OrdersPanel: React.FC<OrdersPanelProps> = ({ onRefreshNotifications, dataTimestamp }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [proofingImageUrl, setProofingImageUrl] = useState('');
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [panelError, setPanelError] = useState<string | null>(null);
    const [loadingAction, setLoadingAction] = useState<{ type: string, id: string } | null>(null);

    const isOpen = isBusinessOpen();

    const fetchAllData = useCallback(() => {
        setIsLoading(true);
        setOrders(getOrders());
        setTables(getTables());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData, dataTimestamp]);
    
    const { activeOrders, finishedOrders } = useMemo(() => {
        const active: Order[] = [];
        const finished: Order[] = [];
        orders.forEach(order => {
            if (isOrderFinished(order.status)) {
                finished.push(order);
            } else {
                active.push(order);
            }
        });
        return { activeOrders: active, finishedOrders: finished };
    }, [orders]);
    
    const activeOrderColumns = useMemo(() => {
        const allColumns = [
            { title: 'Pendientes', statuses: [OrderStatus.PENDING], orders: activeOrders.filter(o => o.status === OrderStatus.PENDING).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) },
            { title: 'Confirmados', statuses: [OrderStatus.CONFIRMED], orders: activeOrders.filter(o => o.status === OrderStatus.CONFIRMED).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) },
            { title: 'En Preparación', statuses: [OrderStatus.PREPARING], orders: activeOrders.filter(o => o.status === OrderStatus.PREPARING).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) },
            { title: 'Listos / En Camino', statuses: [OrderStatus.READY, OrderStatus.DELIVERING, OrderStatus.DINE_IN_PENDING_PAYMENT], orders: activeOrders.filter(o => [OrderStatus.READY, OrderStatus.DELIVERING, OrderStatus.DINE_IN_PENDING_PAYMENT].includes(o.status)).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) },
        ];
        return allColumns.filter(column => column.orders.length > 0);
    }, [activeOrders]);

    const paginatedFinishedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return finishedOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [finishedOrders, currentPage]);

    const totalPages = useMemo(() => Math.ceil(finishedOrders.length / ITEMS_PER_PAGE), [finishedOrders]);
    
    const handleOpenAddModal = () => {
        setEditingOrder(null);
        setIsAddEditModalOpen(true);
    };
    
    const handleOpenEditModal = (order: Order) => {
        setEditingOrder(order);
        setIsAddEditModalOpen(true);
    };

    const handleOpenDeleteModal = (order: Order) => {
        setOrderToDelete(order);
        setIsDeleteModalOpen(true);
    };

    const handleOpenDetailsModal = (order: Order) => {
        setViewingOrder(order);
        setIsDetailsModalOpen(true);
    };

    const handleCloseModals = () => {
        setIsAddEditModalOpen(false);
        setIsDeleteModalOpen(false);
        setIsDetailsModalOpen(false);
        setIsExportModalOpen(false);
        setEditingOrder(null);
        setOrderToDelete(null);
        setViewingOrder(null);
    };
    
    const handleSaveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => {
        if (orderData.id) {
            await updateOrder(orderData as Partial<Order> & { id: string });
        } else {
            await saveOrder({ ...orderData, createdBy: CreatedBy.ADMIN });
        }
        fetchAllData();
        handleCloseModals();
    };
    
    const handleConfirmDelete = async () => {
        if (orderToDelete) {
          await deleteOrder(orderToDelete.id);
          fetchAllData();
          handleCloseModals();
        }
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setLoadingAction({ type: 'status', id: orderId });
        try {
            setPanelError(null);
            if (newStatus === OrderStatus.CANCELLED) {
                const order = orders.find(o => o.id === orderId);
                if (order?.reservationId) {
                    await updateReservationStatus(order.reservationId, ReservationStatus.CANCELLED, ReservationCancellationReason.ADMIN);
                }
            }
            await updateOrderStatus(orderId, newStatus);
            toastService.show('Estado del pedido actualizado.', 'success');
            fetchAllData();
            onRefreshNotifications();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            setPanelError(message);
            toastService.show(message, 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleMarkAsPaid = async (order: Order) => {
        setLoadingAction({ type: 'payment', id: order.id });
        try {
            setPanelError(null);
            await markOrderAsPaid(order.id, order.paymentMethod);
            toastService.show('Pago aprobado con éxito.', 'success');
            fetchAllData();
            onRefreshNotifications();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado al marcar como pagado.';
            setPanelError(message);
            toastService.show(message, 'error');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleViewProof = (url: string) => {
        setProofingImageUrl(url);
        setIsProofModalOpen(true);
    };

    const toggleExpandOrder = (orderId: string) => {
        setExpandedOrderId(prevId => prevId === orderId ? null : orderId);
    };

    const handleExportOrders = (startDate: string, endDate: string) => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');

        const filtered = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= start && orderDate <= end;
        });

        if (filtered.length === 0) {
            throw new Error('No hay pedidos en el rango de fechas seleccionado para exportar.');
        }

        const headers = "ID Pedido,Fecha,Cliente,Teléfono,Tipo,Estado,Método de Pago,Pagado,Total,Artículos\n";
        
        const csvRows = filtered.map(o => {
            const itemsStr = o.items.map(i => `${i.quantity}x ${i.name.replace(/"/g, '""')}`).join(' | ');
            const row = [
                o.id.split('-')[1],
                new Date(o.createdAt).toLocaleString('es-AR'),
                o.customer.name.replace(/"/g, '""'),
                o.customer.phone || '',
                o.type,
                o.status,
                o.paymentMethod,
                o.isPaid ? 'Sí' : 'No',
                o.total,
                itemsStr
            ];
            return row.map(value => `"${value}"`).join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `pedidos_${startDate}_a_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        handleCloseModals();
    };


    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestión de Pedidos</h2>
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center justify-center bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        Exportar
                    </button>
                    <div className="relative group">
                        <button
                            onClick={handleOpenAddModal}
                            disabled={!isOpen}
                            className="flex items-center justify-center w-full bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Agregar Pedido
                        </button>
                        {!isOpen && (
                            <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 -translate-x-1/2 w-max z-10">
                                No se pueden crear pedidos fuera del horario de atención.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {panelError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 animate-fade-in" role="alert">
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline ml-2">{panelError}</span>
                    <button onClick={() => setPanelError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            {isLoading ? <p className="dark:text-white">Cargando pedidos...</p> : (
                <>
                    <div className="flex gap-6 mb-8 overflow-x-auto pb-4 -mx-4 px-4">
                        {activeOrderColumns.length > 0 ? (
                            activeOrderColumns.map(column => (
                                <div key={column.title} className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4 flex flex-col w-[350px] flex-shrink-0">
                                    <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200 border-b-2 dark:border-gray-700 pb-2 mb-4 flex justify-between">
                                        <span>{column.title}</span>
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2.5 py-0.5 text-sm font-semibold">{column.orders.length}</span>
                                    </h3>
                                    <div className="space-y-4 flex-grow h-[60vh] overflow-y-auto pr-2 -mr-2">
                                        {column.orders.map(order => (
                                            <OrderCard
                                                key={order.id}
                                                order={order}
                                                tables={tables}
                                                onStatusChange={handleStatusChange}
                                                onEdit={handleOpenEditModal}
                                                onDelete={handleOpenDeleteModal}
                                                onViewDetails={handleOpenDetailsModal}
                                                onMarkAsPaid={handleMarkAsPaid}
                                                onViewProof={handleViewProof}
                                                loadingAction={loadingAction}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="w-full text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <PackageIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay pedidos activos</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">Los nuevos pedidos aparecerán aquí cuando se creen.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-12">
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Historial de Pedidos</h2>
                        {finishedOrders.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <p className="text-gray-500 dark:text-gray-400">No hay pedidos completados o cancelados.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto responsive-table">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th scope="col" className="px-2 py-3"></th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID Pedido</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pago</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Finalizado</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {paginatedFinishedOrders.map((order) => {
                                                const isExpanded = expandedOrderId === order.id;
                                                const tableNames = order.tableIds?.map(id => tables.find(t => t.id === id)?.name || id).join(', ');
                                                return (
                                                <Fragment key={order.id}>
                                                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                        <td className="px-2 py-4 whitespace-nowrap text-sm">
                                                            <button onClick={() => toggleExpandOrder(order.id)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                                                                {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <ChevronDownIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
                                                            </button>
                                                        </td>
                                                        <td data-label="ID Pedido" className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">{order.id.split('-')[1]}</td>
                                                        <td data-label="Cliente" className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{order.customer.name}</div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">{order.customer.phone}</div>
                                                        </td>
                                                        <td data-label="Tipo" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            {order.type === OrderType.PICKUP && 'Retiro'}
                                                            {order.type === OrderType.DELIVERY && 'Delivery'}
                                                            {order.type === OrderType.DINE_IN && `En Mesa (${tableNames || 'N/A'})`}
                                                        </td>
                                                        <td data-label="Pago" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            <div>{order.paymentMethod}</div>
                                                            <div className={`text-xs font-semibold ${order.isPaid ? 'text-green-600' : 'text-yellow-600'}`}>
                                                                {order.isPaid ? 'Pagado' : 'Pendiente'}
                                                                {order.paymentProofUrl && (
                                                                    <button onClick={() => handleViewProof(order.paymentProofUrl!)} className="ml-1 text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">(ver)</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td data-label="Total" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${order.total.toLocaleString('es-AR')}</td>
                                                        <td data-label="Finalizado" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{order.finishedAt ? new Date(order.finishedAt).toLocaleString('es-AR') : 'N/A'}</td>
                                                        <td data-label="Estado" className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                            <div className="flex items-center justify-center space-x-4">
                                                                 <button onClick={() => handleOpenDetailsModal(order)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" aria-label={`Ver detalles del pedido ${order.id}`}>
                                                                    <InfoIcon className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => handleOpenDeleteModal(order)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" aria-label={`Eliminar pedido ${order.id}`}>
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                                                            <td colSpan={9} className="p-0">
                                                                <div className="px-8 py-4">
                                                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Detalles del Pedido:</h4>
                                                                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                                                        {order.items.map((item, index) => (
                                                                            <li key={index} className="py-2 flex justify-between items-center text-sm">
                                                                                <span className="text-gray-600 dark:text-gray-400">{item.isPromotion ? '🎁' : ''} {item.name} <span className="text-gray-500 dark:text-gray-500 font-mono">x{item.quantity}</span></span>
                                                                                <span className="font-medium text-gray-800 dark:text-gray-200">${(item.price * item.quantity).toLocaleString('es-AR')}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-center">
                                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <AddOrderModal isOpen={isAddEditModalOpen} onClose={handleCloseModals} onSave={handleSaveOrder} orderToEdit={editingOrder} />
            <DeleteOrderConfirmationModal isOpen={isDeleteModalOpen} onClose={handleCloseModals} onConfirm={handleConfirmDelete} orderId={orderToDelete?.id || ''} />
            <PaymentProofModal isOpen={isProofModalOpen} onClose={() => setIsProofModalOpen(false)} imageUrl={proofingImageUrl} />
            <OrderDetailsModal isOpen={isDetailsModalOpen} onClose={handleCloseModals} order={viewingOrder} tables={tables} />
            <ExportOrdersModal isOpen={isExportModalOpen} onClose={handleCloseModals} onConfirm={handleExportOrders} />
        </div>
    );
};

export default OrdersPanel;
