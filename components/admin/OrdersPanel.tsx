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
// Fix: Add missing import for PayOrderModal
import PayOrderModal from './PayOrderModal';

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
    const isOrderEditable = order.status === OrderStatus.PENDING;
    const isLoading = loadingAction?.type === 'status' && loadingAction?.id === order.id;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-3 border-l-4 ${getStatusBorderColor(order.status)} animate-fade-in`}>
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-2">
                <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">{order.customer.name}</p>
                <p className="font-bold text-lg text-primary">${order.total.toLocaleString('es-AR')}</p>
            </div>
            
            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    {order.type === 'pickup' && <PackageIcon className="w-5 h-5"/>}
                    {order.type === 'delivery' && <UsersIcon className="w-5 h-5"/>}
                    {order.type === 'dine-in' && <UtensilsIcon className="w-5 h-5"/>}
                    <span>{order.type}</span>
                </div>
                {order.tableIds && order.tableIds.length > 0 && (
                    <span className="font-semibold">{order.tableIds.map(id => tables.find(t => t.id === id)?.name || '?').join(', ')}</span>
                )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 mt-2 min-h-[2rem]">
                <div className="flex items-center gap-2">
                    <strong className="text-sm">Pago:</strong>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${order.isPaid ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'}`}>
                    {order.isPaid ? 'Pagado' : 'Pendiente'}
                    </span>
                </div>
                {currentStatusInfo && <StatusTimer startDate={currentStatusInfo.startedAt} />}
            </div>

            {order.type === OrderType.DELIVERY && order.status === OrderStatus.CONFIRMED && !order.isPaid && (
                <p className="text-xs text-center text-yellow-800 bg-yellow-50 p-2 rounded-md">
                    El pago debe ser aprobado para pasar a preparación.
                </p>
            )}

             {!order.isPaid && (order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.DINE_IN_PENDING_PAYMENT) && (
                 <div className="flex gap-2">
                    <button onClick={() => onMarkAsPaid(order)} className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-600 transition-colors text-sm">
                       <CheckCircleIcon className="w-5 h-5"/> Aprobar Pago
                    </button>
                    {order.paymentProofUrl && <button onClick={() => onViewProof(order.paymentProofUrl!)} className="bg-blue-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm">Ver</button>}
                 </div>
            )}
            
            <div className="flex gap-2 items-center">
                {isLoading ? (
                     <div className="flex-grow flex justify-center items-center h-[34px] bg-gray-100 dark:bg-gray-700 rounded-full">
                        <Spinner color="border-primary" />
                    </div>
                ) : (
                    <select
                        value={order.status}
                        onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={nextStatuses.length === 0}
                        className={`flex-grow appearance-none px-3 py-2 text-xs leading-5 font-semibold rounded-full border-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 ${getStatusColor(order.status)}`}
                    >
                        <option value={order.status}>{order.status}</option>
                        {nextStatuses.map(status => (
                            <option key={status} value={status}>
                                &#8618; {status}
                            </option>
                        ))}
                    </select>
                )}
                <button onClick={() => onViewDetails(order)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><InfoIcon className="w-5 h-5"/></button>
                <button onClick={() => onEdit(order)} disabled={!isOrderEditable} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 rounded-full disabled:text-gray-300 dark:disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent"><EditIcon className="w-5 h-5"/></button>
                <button onClick={() => onDelete(order)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon className="w-5 h-5"/></button>
            </div>
        </div>
    );
};


const OrdersPanel: React.FC<OrdersPanelProps> = ({ onRefreshNotifications, dataTimestamp }) => {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderToModify, setOrderToModify] = useState<Order | null>(null);
  const [imageUrlForProof, setImageUrlForProof] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingAction, setLoadingAction] = useState<{ type: string; id: string } | null>(null);
  const isOpen = isBusinessOpen();

  const fetchData = useCallback(() => {
    const allOrders = getOrders();
    const active: Order[] = [];
    const finished: Order[] = [];
    allOrders.forEach(order => {
        if (isOrderFinished(order.status)) {
            finished.push(order);
        } else {
            active.push(order);
        }
    });
    setActiveOrders(active);
    setFinishedOrders(finished);
    setTables(getTables());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
    setIsLoading(false);
  }, [fetchData, dataTimestamp]);
  
  const activeOrderColumns = useMemo(() => {
    const allColumns = [
      { title: 'Pendientes', status: OrderStatus.PENDING, orders: activeOrders.filter(o => o.status === OrderStatus.PENDING).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) },
      { title: 'Confirmados', status: OrderStatus.CONFIRMED, orders: activeOrders.filter(o => o.status === OrderStatus.CONFIRMED) },
      { title: 'En Preparación', status: OrderStatus.PREPARING, orders: activeOrders.filter(o => o.status === OrderStatus.PREPARING) },
      { title: 'Listos', status: OrderStatus.READY, orders: activeOrders.filter(o => o.status === OrderStatus.READY) },
      { title: 'En Camino', status: OrderStatus.DELIVERING, orders: activeOrders.filter(o => o.status === OrderStatus.DELIVERING) },
      { title: 'En Mesa (S/Pagar)', status: OrderStatus.DINE_IN_PENDING_PAYMENT, orders: activeOrders.filter(o => o.status === OrderStatus.DINE_IN_PENDING_PAYMENT) },
    ];
    return allColumns.filter(column => column.orders.length > 0);
  }, [activeOrders]);

  const paginatedFinishedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return finishedOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [finishedOrders, currentPage]);

  const totalPages = useMemo(() => Math.ceil(finishedOrders.length / ITEMS_PER_PAGE), [finishedOrders]);
  
  const handleOpenAddModal = () => { setEditingOrder(null); setIsAddModalOpen(true); };
  const handleOpenEditModal = (order: Order) => { setEditingOrder(order); setIsAddModalOpen(true); };
  const handleOpenDeleteModal = (order: Order) => { setOrderToModify(order); setIsDeleteModalOpen(true); };
  const handleOpenPayModal = (order: Order) => { setOrderToModify(order); setIsPayModalOpen(true); };
  const handleOpenProofModal = (url: string) => { setImageUrlForProof(url); setIsProofModalOpen(true); };
  const handleOpenDetailsModal = (order: Order) => { setOrderToModify(order); setIsDetailsModalOpen(true); };
  const handleOpenExportModal = () => setIsExportModalOpen(true);
  
  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsPayModalOpen(false);
    setIsProofModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsExportModalOpen(false);
    setOrderToModify(null);
    setEditingOrder(null);
  };
  
  const handleSaveOrder = async (
    orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }
  ) => {
    const isEditing = !!orderData.id;
    const action = isEditing ? 'update' : 'add';
    const tempId = orderData.id || `temp-${Date.now()}`;
    setLoadingAction({ type: action, id: tempId });
    try {
      if (isEditing) {
        await updateOrder(orderData as Partial<Order> & { id: string });
        toastService.show('Pedido actualizado con éxito.', 'success');
      } else {
        await saveOrder({ ...orderData, createdBy: CreatedBy.ADMIN });
        toastService.show('Pedido agregado con éxito.', 'success');
      }
      handleCloseModals(); // Close modal only on success
      fetchData();
      onRefreshNotifications();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el pedido.';
      toastService.show(message, 'error');
      // On error, modal stays open for user to fix and retry.
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (orderToModify) {
      if(orderToModify.reservationId){
         await updateReservationStatus(orderToModify.reservationId, ReservationStatus.CANCELLED, ReservationCancellationReason.ADMIN);
      }
      await deleteOrder(orderToModify.id);
      fetchData();
      handleCloseModals();
    }
  };
  
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setLoadingAction({ type: 'status', id: orderId });
    try {
        await updateOrderStatus(orderId, newStatus);
        fetchData();
        onRefreshNotifications();
        toastService.show('Estado del pedido actualizado.', 'success');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cambiar estado.';
        toastService.show(message, 'error');
    } finally {
        setLoadingAction(null);
    }
  };
  
  const handleMarkAsPaid = async (order: Order, paymentMethod?: PaymentMethod, paymentProofUrl?: string | null) => {
    setLoadingAction({ type: 'pay', id: order.id });
     try {
        await markOrderAsPaid(order.id, paymentMethod || order.paymentMethod, paymentProofUrl);
        fetchData();
        onRefreshNotifications();
        toastService.show('Pago aprobado con éxito.', 'success');
    } catch (err) {
         const message = err instanceof Error ? err.message : 'Error al marcar como pagado.';
         toastService.show(message, 'error');
    } finally {
        setLoadingAction(null);
        handleCloseModals();
    }
  };

  const handleExport = (startDate: string, endDate: string) => {
    const ordersToExport = getOrders().filter(o => {
        const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
        return orderDate >= startDate && orderDate <= endDate;
    });

    if (ordersToExport.length === 0) {
        throw new Error('No hay pedidos en el rango de fechas seleccionado.');
    }

    const headers = [ "ID", "Fecha", "Cliente", "Teléfono", "Tipo", "Estado", "Total", "Pagado", "Origen", "Artículos" ];
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + ordersToExport.map(o => {
            const row = [
                o.id.split('-')[1],
                new Date(o.createdAt).toLocaleString('es-AR'),
                `"${o.customer.name.replace(/"/g, '""')}"`,
                o.customer.phone || '',
                o.type,
                o.status,
                o.total,
                o.isPaid ? 'Sí' : 'No',
                o.createdBy,
                `"${o.items.map(i => `${i.quantity}x ${i.name}`).join('; ')}"`
            ];
            return row.join(",");
        }).join("\n");
    
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
        <div className="flex items-center gap-2">
            <button
                onClick={handleOpenExportModal}
                className="flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
                <DownloadIcon className="w-5 h-5 mr-2" />
                Exportar
            </button>
            <button
                onClick={handleOpenAddModal}
                disabled={!!loadingAction || !isOpen}
                className="flex items-center justify-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                <PlusIcon className="w-5 h-5 mr-2" />
                Agregar Pedido
            </button>
        </div>
      </div>

       {!isOpen && <div className="mb-4 text-center p-2 rounded-md text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
        El local está actualmente CERRADO. Solo se pueden recibir pedidos para cuando el local abra.
      </div>}

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
                                        onMarkAsPaid={() => handleOpenPayModal(order)}
                                        onViewProof={handleOpenProofModal}
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
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Los nuevos pedidos aparecerán aquí.</p>
                    </div>
                )}
            </div>
          
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Historial de Pedidos</h2>
              {finishedOrders.length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <p className="text-gray-500 dark:text-gray-400">No hay pedidos finalizados.</p>
                  </div>
              ) : (
                  <>
                  <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto responsive-table">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado Final</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {paginatedFinishedOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td data-label="Cliente" className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-white">{order.customer.name}</div></td>
                                    <td data-label="Fecha" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(order.createdAt).toLocaleDateString('es-AR')}</td>
                                    <td data-label="Total" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-200">${order.total.toLocaleString('es-AR')}</td>
                                    <td data-label="Estado Final" className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <div className="flex items-center justify-center space-x-4">
                                            <button onClick={() => handleOpenDetailsModal(order)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"><InfoIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleOpenDeleteModal(order)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"><TrashIcon className="w-5 h-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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

      <AddOrderModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModals}
        onSave={handleSaveOrder}
        orderToEdit={editingOrder}
        isSaving={loadingAction?.type === 'add' || loadingAction?.type === 'update'}
        isStoreOpen={isOpen}
      />
      <DeleteOrderConfirmationModal isOpen={isDeleteModalOpen} onClose={handleCloseModals} onConfirm={handleConfirmDelete} orderId={orderToModify?.id || ''}/>
      <PaymentProofModal isOpen={isProofModalOpen} onClose={handleCloseModals} imageUrl={imageUrlForProof} />
      <OrderDetailsModal isOpen={isDetailsModalOpen} onClose={handleCloseModals} order={orderToModify} tables={tables}/>
      <ExportOrdersModal isOpen={isExportModalOpen} onClose={handleCloseModals} onConfirm={handleExport} />
      <PayOrderModal 
        isOpen={isPayModalOpen} 
        onClose={handleCloseModals} 
        onConfirm={(paymentMethod, paymentProofUrl) => orderToModify && handleMarkAsPaid(orderToModify, paymentMethod, paymentProofUrl)}
        totalAmount={orderToModify?.total || 0}
      />
    </div>
  );
};

export default OrdersPanel;