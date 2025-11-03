import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import type { Reservation, Table, Order, ReservationSettings } from '../../types';
import { ReservationStatus, ReservationCancellationReason, OrderStatus } from '../../types';
import { getReservationsFromCache as getReservations, getReservationSettings, saveReservationSettings, addReservation, updateReservation, deleteReservation, updateReservationStatus } from '../../services/reservationService';
import { saveOrder, getOrdersFromCache as getOrders, isOrderFinished, updateOrderStatus } from '../../services/orderService';
import { getTablesFromCache as getTables } from '../../services/tableService';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { UsersIcon } from '../icons/UsersIcon';
import Pagination from './Pagination';
import AddReservationModal from './AddReservationModal';
import DeleteReservationConfirmationModal from './DeleteReservationConfirmationModal';
import CancelReservationModal from './CancelReservationModal';
import StatusTimer from './StatusTimer';
import CountdownTimer from './CountdownTimer';
import AddOrderModal from './AddOrderModal';
import ReservationDetailsModal from './ReservationDetailsModal';
import { SettingsIcon } from '../icons/SettingsIcon';
import ReservationSettingsModal from './ReservationSettingsModal';
import { CalendarIcon } from '../icons/CalendarIcon';
import { toastService } from '../../services/toastService';
import { Spinner } from './Spinner';

const ITEMS_PER_PAGE = 10;

interface ReservationsPanelProps {
  onRefreshNotifications: () => void;
  dataTimestamp: number;
}

const getNextValidStatuses = (reservation: Reservation, allOrders: Order[]): ReservationStatus[] => {
    const now = new Date();
    const resTime = new Date(reservation.reservationTime);
    const confirmationWindowStart = new Date(resTime.getTime() - 30 * 60 * 1000); // 30 minutes before

    switch (reservation.status) {
        case ReservationStatus.PENDING:
            return [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED];
        case ReservationStatus.CONFIRMED:
            if (now >= confirmationWindowStart) {
                // Within 30 mins of the reservation, allow seating or marking as no-show
                return [ReservationStatus.SEATED, ReservationStatus.NO_SHOW, ReservationStatus.CANCELLED];
            }
            return [ReservationStatus.CANCELLED]; // Only cancellable before the window
        case ReservationStatus.SEATED:
            const associatedOrder = allOrders.find(o => o.id === reservation.orderId);
            // The order must be finished (paid and completed, or cancelled)
            if (associatedOrder && isOrderFinished(associatedOrder.status)) {
                return [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED];
            }
            // Can only cancel if order is not finished
            return [ReservationStatus.CANCELLED];
        default:
            return []; // No transitions from finished states
    }
};

const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
        case ReservationStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
        case ReservationStatus.CONFIRMED: return 'bg-blue-100 text-blue-800';
        case ReservationStatus.SEATED: return 'bg-indigo-100 text-indigo-800';
        case ReservationStatus.COMPLETED: return 'bg-green-100 text-green-800';
        case ReservationStatus.CANCELLED: return 'bg-red-100 text-red-800';
        case ReservationStatus.NO_SHOW: return 'bg-gray-200 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getStatusBorderColor = (status: ReservationStatus) => {
    switch (status) {
        case ReservationStatus.PENDING: return 'border-yellow-400';
        case ReservationStatus.CONFIRMED: return 'border-blue-400';
        case ReservationStatus.SEATED: return 'border-indigo-400';
        default: return 'border-gray-300 dark:border-gray-600';
    }
};

const ReservationCard: React.FC<{
    reservation: Reservation;
    tables: Table[];
    orders: Order[];
    onStatusChange: (reservationId: string, newStatus: ReservationStatus) => void;
    onEdit: (reservation: Reservation) => void;
    onDelete: (reservation: Reservation) => void;
    onViewDetails: (reservation: Reservation) => void;
    isEditable: boolean;
    loadingAction: { type: string, id: string } | null;
}> = ({ reservation, tables, orders, onStatusChange, onEdit, onDelete, onViewDetails, isEditable, loadingAction }) => {
    const nextStatuses = getNextValidStatuses(reservation, orders);
    const currentStatusInfo = reservation.statusHistory[reservation.statusHistory.length - 1];
    const tableNames = reservation.tableIds.map(id => tables.find(t => t.id === id)?.name || '?').join(', ');
    const isLoading = loadingAction?.type === 'status' && loadingAction?.id === reservation.id;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-3 border-l-4 ${getStatusBorderColor(reservation.status)} animate-fade-in`}>
            <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-2">
                 <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">{reservation.customerName}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">{reservation.customerPhone}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <UsersIcon className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                    <span className="font-semibold">{reservation.guests}</span>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-sm text-gray-600 dark:text-gray-400">{new Date(reservation.reservationTime).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    <p className="font-bold text-lg text-primary">{new Date(reservation.reservationTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs</p>
                </div>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 mt-2 min-h-[2rem]">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{tableNames || 'Mesa no asignada'}</span>
                {reservation.status === ReservationStatus.CONFIRMED ? (
                    <CountdownTimer endDate={reservation.reservationTime} />
                ) : (
                    currentStatusInfo && <StatusTimer startDate={currentStatusInfo.startedAt} />
                )}
            </div>
            
             {reservation.status === ReservationStatus.SEATED && !nextStatuses.includes(ReservationStatus.COMPLETED) && (
                <p className="text-xs text-center text-indigo-700 bg-indigo-50 p-2 rounded-md">
                    El pedido asociado debe estar finalizado para completar la reserva.
                </p>
            )}

            <div className="flex gap-2 items-center">
                {isLoading ? (
                     <div className="flex-grow flex justify-center items-center h-[34px] bg-gray-100 dark:bg-gray-700 rounded-full">
                        <Spinner color="border-primary" />
                    </div>
                ) : (
                    <select
                        value={reservation.status}
                        onChange={(e) => onStatusChange(reservation.id, e.target.value as ReservationStatus)}
                        disabled={nextStatuses.length === 0}
                        className={`flex-grow appearance-none px-3 py-2 text-xs leading-5 font-semibold rounded-full border-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 ${getStatusColor(reservation.status)}`}
                    >
                        <option value={reservation.status}>{reservation.status}</option>
                        {nextStatuses.map(status => (
                            <option key={status} value={status}>
                                 &#8618; {status}
                            </option>
                        ))}
                    </select>
                )}
                <button onClick={() => onViewDetails(reservation)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><InfoIcon className="w-5 h-5"/></button>
                {isEditable && (
                    <button onClick={() => onEdit(reservation)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-700 rounded-full"><EditIcon className="w-5 h-5"/></button>
                )}
                <button onClick={() => onDelete(reservation)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon className="w-5 h-5"/></button>
            </div>
        </div>
    );
};

const ReservationsPanel: React.FC<ReservationsPanelProps> = ({ onRefreshNotifications, dataTimestamp }) => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Settings state
    const [currentSettings, setCurrentSettings] = useState(getReservationSettings());

    // Modals state
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isCancelModalOpen, setCancelModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
    const [reservationToModify, setReservationToModify] = useState<Reservation | null>(null);
    const [reservationToConvert, setReservationToConvert] = useState<Reservation | null>(null);
    const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);
    const [loadingAction, setLoadingAction] = useState<{ type: string, id: string } | null>(null);
    
    const fetchAllData = useCallback(() => {
        setReservations(getReservations());
        setTables(getTables());
        setOrders(getOrders());
        setCurrentSettings(getReservationSettings());
    }, []);
    
    useEffect(() => {
        setIsLoading(true);
        fetchAllData();
        setIsLoading(false);
    }, [fetchAllData, dataTimestamp]);

    const { activeReservations, finishedReservations } = useMemo(() => {
        const active: Reservation[] = [];
        const finished: Reservation[] = [];
        const finishedStatuses = [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW];
        reservations.forEach(res => {
            if (finishedStatuses.includes(res.status)) {
                finished.push(res);
            } else {
                active.push(res);
            }
        });
        return { activeReservations: active, finishedReservations: finished };
    }, [reservations]);
    
    const activeReservationColumns = useMemo(() => {
        const allColumns = [
            { title: 'Pendientes', status: ReservationStatus.PENDING, reservations: activeReservations.filter(r => r.status === ReservationStatus.PENDING).sort((a,b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime()) },
            { title: 'Confirmadas', status: ReservationStatus.CONFIRMED, reservations: activeReservations.filter(r => r.status === ReservationStatus.CONFIRMED).sort((a,b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime()) },
            { title: 'Sentados', status: ReservationStatus.SEATED, reservations: activeReservations.filter(r => r.status === ReservationStatus.SEATED).sort((a,b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime()) },
        ];
        return allColumns.filter(column => column.reservations.length > 0);
    }, [activeReservations]);

    const paginatedFinishedReservations = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return finishedReservations.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [finishedReservations, currentPage]);

    const totalPages = useMemo(() => Math.ceil(finishedReservations.length / ITEMS_PER_PAGE), [finishedReservations]);

    const handleSaveSettings = async (newSettings: ReservationSettings) => {
        await saveReservationSettings(newSettings);
        fetchAllData();
    };
    
    const handleOpenAddModal = () => { setEditingReservation(null); setAddEditModalOpen(true); };
    const handleOpenEditModal = (res: Reservation) => { setEditingReservation(res); setAddEditModalOpen(true); };
    const handleOpenDeleteModal = (res: Reservation) => { setReservationToModify(res); setDeleteModalOpen(true); };
    const handleOpenDetailsModal = (res: Reservation) => { setViewingReservation(res); setIsDetailsModalOpen(true); };

    const handleCloseModals = () => {
        setAddEditModalOpen(false);
        setDeleteModalOpen(false);
        setCancelModalOpen(false);
        setIsOrderModalOpen(false);
        setIsDetailsModalOpen(false);
        setIsSettingsModalOpen(false);
        setReservationToConvert(null);
        setReservationToModify(null);
        setViewingReservation(null);
        setEditingReservation(null);
    };
    
    const handleSaveReservation = (resData: Omit<Reservation, 'id' | 'createdAt'> & { id?: string }) => {
        if (resData.id) {
            const existing = reservations.find(r => r.id === resData.id);
            if (existing) updateReservation({ ...existing, ...resData });
        } else {
            addReservation(resData as Omit<Reservation, 'id' | 'createdAt' | 'status' | 'statusHistory' | 'finishedAt'>);
        }
        fetchAllData();
        handleCloseModals();
    };
    
    const handleConfirmDelete = () => {
        if(reservationToModify) {
            deleteReservation(reservationToModify.id);
            fetchAllData();
            handleCloseModals();
        }
    };
    
    const handleStatusChange = async (reservationId: string, newStatus: ReservationStatus) => {
        const reservation = reservations.find(r => r.id === reservationId);
        if (!reservation) return;

        if (newStatus === ReservationStatus.SEATED) {
            setReservationToConvert(reservation);
            setIsOrderModalOpen(true);
        } else if (newStatus === ReservationStatus.CANCELLED) {
            setReservationToModify(reservation);
            setCancelModalOpen(true);
        } else {
            setLoadingAction({ type: 'status', id: reservationId });
            try {
                await updateReservationStatus(reservationId, newStatus);
                toastService.show('Estado de la reserva actualizado.', 'success');
                fetchAllData();
                onRefreshNotifications();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al actualizar estado.';
                toastService.show(message, 'error');
            } finally {
                setLoadingAction(null);
            }
        }
    };
    
    const handleConfirmCancellation = async (reason: ReservationCancellationReason) => {
        if (reservationToModify) {
            setLoadingAction({ type: 'cancel', id: reservationToModify.id });
            try {
                if (reservationToModify.orderId) {
                    const order = orders.find(o => o.id === reservationToModify.orderId);
                    if (order && !isOrderFinished(order.status)) {
                        await updateOrderStatus(order.id, OrderStatus.CANCELLED);
                    }
                }
                await updateReservationStatus(reservationToModify.id, ReservationStatus.CANCELLED, reason);
                toastService.show('Reserva cancelada con éxito.', 'success');
                fetchAllData();
                onRefreshNotifications();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al cancelar la reserva.';
                toastService.show(message, 'error');
            } finally {
                setLoadingAction(null);
                handleCloseModals();
            }
        }
    };

    const handleSaveConvertedOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => {
        if (!reservationToConvert) return;
        setLoadingAction({ type: 'seat', id: reservationToConvert.id });
        try {
            const newOrder = await saveOrder({
                ...orderData,
                reservationId: reservationToConvert.id,
                createdBy: reservationToConvert.createdBy,
            });
            
            if(newOrder) {
                const existingReservation = getReservations().find(r => r.id === reservationToConvert.id);
                if (existingReservation) {
                    const now = new Date().toISOString();
                    const updatedRes: Reservation = {
                        ...existingReservation,
                        status: ReservationStatus.SEATED,
                        orderId: newOrder.id,
                        statusHistory: [
                            ...existingReservation.statusHistory,
                            { status: ReservationStatus.SEATED, startedAt: now }
                        ]
                    };
                    await updateReservation(updatedRes);
                }
            }
            toastService.show('Pedido creado y reserva actualizada.', 'success');
        } catch(err) {
             const message = err instanceof Error ? err.message : 'Error al crear el pedido.';
             toastService.show(message, 'error');
        } finally {
            setLoadingAction(null);
            handleCloseModals();
            fetchAllData();
            onRefreshNotifications();
        }
    };

    const isReservationEditable = (reservation: Reservation): boolean => {
        if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
            return false;
        }
        const reservationTime = new Date(reservation.reservationTime);
        const lockTime = new Date(reservationTime.getTime() - currentSettings.modificationLockTime * 60 * 1000);
        return new Date() < lockTime;
    };

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestión de Reservas</h2>
                 <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsSettingsModalOpen(true)} 
                        className="flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <SettingsIcon className="w-5 h-5 mr-2" />
                        Configuración
                    </button>
                    <button 
                        onClick={handleOpenAddModal} 
                        className="flex items-center justify-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Agregar Reserva
                    </button>
                </div>
            </div>
            
            {isLoading ? <p className="dark:text-white">Cargando reservas...</p> : (
                <>
                    <div className="flex gap-6 mb-8 overflow-x-auto pb-4 -mx-4 px-4">
                        {activeReservationColumns.length > 0 ? (
                            activeReservationColumns.map(column => (
                                <div key={column.title} className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4 flex flex-col w-[350px] flex-shrink-0">
                                    <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200 border-b-2 dark:border-gray-700 pb-2 mb-4 flex justify-between">
                                        <span>{column.title}</span>
                                        <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2.5 py-0.5 text-sm font-semibold">{column.reservations.length}</span>
                                    </h3>
                                    <div className="space-y-4 flex-grow h-[60vh] overflow-y-auto pr-2 -mr-2">
                                        {column.reservations.map(res => (
                                            <ReservationCard
                                                key={res.id}
                                                reservation={res}
                                                tables={tables}
                                                orders={orders}
                                                onStatusChange={handleStatusChange}
                                                onEdit={handleOpenEditModal}
                                                onDelete={handleOpenDeleteModal}
                                                onViewDetails={handleOpenDetailsModal}
                                                isEditable={isReservationEditable(res)}
                                                loadingAction={loadingAction}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="w-full text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <CalendarIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay reservas activas</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">Las nuevas reservas aparecerán aquí.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-12">
                         <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Historial de Reservas</h2>
                         {finishedReservations.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <p className="text-gray-500 dark:text-gray-400">No hay reservas finalizadas.</p>
                            </div>
                        ) : (
                             <>
                                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto responsive-table">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hora Reservada</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Finalizado</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {paginatedFinishedReservations.map(res => {
                                            return (
                                                <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td data-label="Cliente" className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{res.customerName}</div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">{res.customerPhone}</div>
                                                    </td>
                                                    <td data-label="Hora Reservada" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(res.reservationTime).toLocaleString('es-AR')}</td>
                                                    <td data-label="Finalizado" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{res.finishedAt ? new Date(res.finishedAt).toLocaleString('es-AR') : 'N/A'}</td>
                                                    <td data-label="Estado" className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(res.status)}`}>
                                                            {res.status}
                                                        </span>
                                                        {res.status === ReservationStatus.CANCELLED && res.cancellationReason && (
                                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{res.cancellationReason}</div>
                                                        )}
                                                    </td>
                                                    <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                    <div className="flex items-center justify-center space-x-4">
                                                        <button onClick={() => handleOpenDetailsModal(res)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"><InfoIcon className="w-5 h-5"/></button>
                                                        <button onClick={() => handleOpenDeleteModal(res)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"><TrashIcon className="w-5 h-5" /></button>
                                                    </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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

            <ReservationSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={handleCloseModals}
                onSave={handleSaveSettings}
                currentSettings={currentSettings}
            />
            <AddReservationModal isOpen={isAddEditModalOpen} onClose={handleCloseModals} onSave={handleSaveReservation} reservationToEdit={editingReservation} />
            <CancelReservationModal 
                isOpen={isCancelModalOpen} 
                onClose={handleCloseModals} 
                onConfirm={handleConfirmCancellation} 
                isSaving={loadingAction?.type === 'cancel' && loadingAction?.id === reservationToModify?.id}
            />
            <DeleteReservationConfirmationModal isOpen={isDeleteModalOpen} onClose={handleCloseModals} onConfirm={handleConfirmDelete} reservationInfo={reservationToModify ? `${reservationToModify.customerName} - ${new Date(reservationToModify.reservationTime).toLocaleDateString()}` : ''} />
            <AddOrderModal
                isOpen={isOrderModalOpen}
                onClose={handleCloseModals}
                onSave={handleSaveConvertedOrder}
                reservationToConvert={reservationToConvert}
                isSaving={loadingAction?.type === 'seat' && loadingAction?.id === reservationToConvert?.id}
            />
            <ReservationDetailsModal 
                isOpen={isDetailsModalOpen}
                onClose={handleCloseModals}
                reservation={viewingReservation}
                tables={tables}
                orders={orders}
            />
        </div>
    );
};

export default ReservationsPanel;
