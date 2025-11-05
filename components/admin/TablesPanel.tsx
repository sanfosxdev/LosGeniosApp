import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getTablesFromCache as getTables, addTable, updateTable, deleteTable, setTableOverrideStatus, enrichTables } from '../../services/tableService';
import { getOrdersFromCache as getOrders, saveOrder, updateOrder, updateOrderStatus, isOrderFinished, markOrderAsPaid } from '../../services/orderService';
import { getReservationsFromCache as getReservations } from '../../services/reservationService';
import { isBusinessOpen } from '../../services/scheduleService';
import type { Table, Order, Reservation, EnrichedTable, TableStatus, PaymentMethod } from '../../types';
import { OrderType, ReservationStatus, CreatedBy, OrderStatus } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { LayoutGridIcon } from '../icons/LayoutGridIcon';
import { LockIcon } from '../icons/LockIcon';
import { UnlockIcon } from '../icons/UnlockIcon';
import { QrCodeIcon } from '../icons/QrCodeIcon';
import AddEditTableModal from './AddEditTableModal';
import DeleteTableConfirmationModal from './DeleteTableConfirmationModal';
import AddOrderModal from './AddOrderModal';
import StatusTimer from './StatusTimer';
import TableDetailsModal from './TableDetailsModal';
import PayOrderModal from './PayOrderModal';
import QRCodeModal from './QRCodeModal';
import { toastService } from '../../services/toastService';
import { Spinner } from './Spinner';

interface TablesPanelProps {
    dataTimestamp: number;
}

const TableCard: React.FC<{
    table: EnrichedTable;
    onEdit: () => void;
    onDelete: () => void;
    onOccupy: () => void;
    onFreeUp: () => void;
    onViewDetails: () => void;
    onModifyOrder: (order: Order) => void;
    onNewOrder: (table: EnrichedTable) => void;
    onPay: (table: EnrichedTable) => void;
    onSetOverrideStatus: (tableId: string, status: 'Bloqueada' | null) => void;
    onShowQr: () => void;
    isOpen: boolean;
    isUpdatingStatus: boolean;
}> = ({ table, onEdit, onDelete, onOccupy, onFreeUp, onViewDetails, onModifyOrder, onNewOrder, onPay, onSetOverrideStatus, onShowQr, isOpen, isUpdatingStatus }) => {
  const statusStyles: Record<TableStatus, { bg: string, border: string, text: string, icon: React.ReactNode }> = {
    'Libre': { bg: 'bg-green-100 dark:bg-green-900/50', border: 'border-green-400', text: 'text-green-800 dark:text-green-300', icon: <div className="w-8 h-8"/> },
    'Ocupada': { bg: 'bg-red-100 dark:bg-red-900/50', border: 'border-red-400', text: 'text-red-800 dark:text-red-300', icon: <PackageIcon className="w-8 h-8 text-red-500"/> },
    'Reservada': { bg: 'bg-blue-100 dark:bg-blue-900/50', border: 'border-blue-400', text: 'text-blue-800 dark:text-blue-300', icon: <ClockIcon className="w-8 h-8 text-blue-500"/> },
    'Bloqueada': { bg: 'bg-orange-100 dark:bg-orange-900/50', border: 'border-orange-400', text: 'text-orange-800 dark:text-orange-300', icon: <LockIcon className="w-8 h-8 text-orange-500"/> },
  };
  const style = statusStyles[table.status];
  const isManuallyBlocked = table.overrideStatus === 'Bloqueada';
  const isEditable = table.status !== 'Ocupada' && !isManuallyBlocked;
  const editableOrder = table.activeOrdersOnTable?.find(o => [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(o.status));
  const allOrdersPaid = table.activeOrdersOnTable?.every(o => o.isPaid) ?? false;

  return (
    <div className={`rounded-lg shadow-md border-l-4 ${style.border} flex flex-col transition-all duration-300 hover:shadow-lg`}>
      <header className={`p-4 rounded-t-md ${style.bg} flex justify-between items-center`}>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{table.name}</h3>
        <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">{table.capacity}</span>
        </div>
      </header>
      <div className="p-4 bg-white dark:bg-gray-800 flex-grow flex flex-col justify-between rounded-b-md">
        <div className="flex items-center gap-4 min-h-[6rem]">
          <div className="flex-shrink-0">{style.icon}</div>
          <div>
            <p className={`font-bold text-lg ${style.text}`}>{table.status}</p>
            {table.status === 'Ocupada' && (
                <>
                    <p className="font-bold text-lg text-primary">${(table.accumulatedTotal || 0).toLocaleString('es-AR')}</p>
                    {table.details?.startTime && <StatusTimer startDate={table.details.startTime} />}
                </>
            )}
            {table.details && table.status !== 'Ocupada' && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <p><strong>Cliente:</strong> {table.details.customerName}</p>
                {table.details.time && <p><strong>Hora:</strong> {table.details.time}</p>}
                <p className="text-xs font-mono text-gray-400 dark:text-gray-500 pt-1">{table.details.type === 'order' ? `Pedido #${table.details.id.split('-')[1]}` : `Reserva #${table.details.id.split('-')[1]}`}</p>
                 {isManuallyBlocked && <p className="mt-2 text-xs italic">Manualmente bloqueada.</p>}
              </div>
            )}
            {table.status === 'Ocupada' && (
                <div className="flex items-center gap-2 mt-2">
                    <strong className="text-sm">Pago:</strong>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${allOrdersPaid ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'}`}>
                    {allOrdersPaid ? 'Pagado' : 'Pendiente'}
                    </span>
                    {table.activeOrdersOnTable && table.activeOrdersOnTable.length > 1 && (
                        <p className="text-xs text-gray-500">({table.activeOrdersOnTable.length} pedidos)</p>
                    )}
                </div>
            )}
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex-grow">
                {isUpdatingStatus ? (
                    <div className="flex justify-center items-center h-10"><Spinner /></div>
                ) : (
                    <>
                        {table.status === 'Libre' && (
                            <div className="relative group">
                                <button onClick={onOccupy} disabled={!isOpen} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">Ocupar</button>
                                {!isOpen && <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 -translate-x-1/2 w-max z-10">El local está cerrado</span>}
                            </div>
                        )}
                         {isManuallyBlocked && (
                            <button onClick={() => onSetOverrideStatus(table.id, null)} className="w-full bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors text-sm">Desbloquear</button>
                         )}
                        {table.status === 'Ocupada' && (
                            <div className="grid grid-cols-2 gap-2">
                                {editableOrder ? (
                                    <div className="relative group">
                                        <button onClick={() => onModifyOrder(editableOrder)} disabled={!isOpen} className="w-full bg-yellow-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-yellow-600 transition-colors text-sm disabled:bg-gray-400">Modificar</button>
                                        {!isOpen && <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 -translate-x-1/2 w-max z-10">El local está cerrado</span>}
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <button onClick={() => onNewOrder(table)} disabled={!isOpen} className="w-full bg-blue-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:bg-gray-400">Nuevo Ped.</button>
                                        {!isOpen && <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 -translate-x-1/2 w-max z-10">El local está cerrado</span>}
                                    </div>
                                )}
                                {!allOrdersPaid ? (
                                    <button onClick={() => onPay(table)} className="bg-green-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-600 transition-colors text-sm">Pagar</button>
                                ) : (
                                    <button onClick={onFreeUp} className="bg-green-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-600 transition-colors text-sm">Liberar</button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <button onClick={onShowQr} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0"><QrCodeIcon className="w-5 h-5"/></button>
            <button onClick={onViewDetails} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0"><InfoIcon className="w-5 h-5"/></button>
            <button onClick={onEdit} disabled={!isEditable} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0 disabled:text-gray-300 dark:disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent"><EditIcon className="w-5 h-5"/></button>
            {table.status !== 'Ocupada' && !isManuallyBlocked && (
                <button onClick={() => onSetOverrideStatus(table.id, 'Bloqueada')} title="Bloquear mesa" className="p-2 text-orange-500 hover:bg-orange-100 rounded-full"><LockIcon className="w-5 h-5"/></button>
            )}
            <button onClick={onDelete} disabled={!isEditable} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0 disabled:text-gray-300 dark:disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent"><TrashIcon className="w-5 h-5"/></button>
        </div>
      </div>
    </div>
  );
};


const TablesPanel: React.FC<TablesPanelProps> = ({ dataTimestamp }) => {
    const [enrichedTables, setEnrichedTables] = useState<EnrichedTable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals state
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    const [tableToEdit, setTableToEdit] = useState<Table | null>(null);
    const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
    const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
    const [preselectedTableIds, setPreselectedTableIds] = useState<string[] | null>(null);
    const [viewingTable, setViewingTable] = useState<EnrichedTable | null>(null);
    const [tableToPay, setTableToPay] = useState<EnrichedTable | null>(null);
    const [tableForQr, setTableForQr] = useState<Table | null>(null);
    const [updatingStatusTableId, setUpdatingStatusTableId] = useState<string | null>(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    
    const isOpen = isBusinessOpen();

    const fetchDataAndEnrichTables = useCallback(() => {
        const tables = getTables();
        const orders = getOrders();
        const reservations = getReservations();
        const newEnrichedTables = enrichTables(tables, orders, reservations);
        setEnrichedTables(newEnrichedTables);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchDataAndEnrichTables();
    }, [fetchDataAndEnrichTables, dataTimestamp]);

    // Modals Handlers
    const handleOpenAddModal = () => { setTableToEdit(null); setAddEditModalOpen(true); };
    const handleOpenEditModal = (table: Table) => { setTableToEdit(table); setAddEditModalOpen(true); };
    const handleOpenDeleteModal = (table: Table) => { setTableToDelete(table); setDeleteModalOpen(true); };
    const handleOpenDetailsModal = (table: EnrichedTable) => { setViewingTable(table); setIsDetailsModalOpen(true); };
    const handleOpenQrModal = (table: Table) => { setTableForQr(table); setIsQrModalOpen(true); };


    const handleCloseModals = () => {
        setAddEditModalOpen(false);
        setDeleteModalOpen(false);
        setIsOrderModalOpen(false);
        setIsDetailsModalOpen(false);
        setIsPayModalOpen(false);
        setIsQrModalOpen(false);
        setTableToEdit(null);
        setTableToDelete(null);
        setPreselectedTableIds(null);
        setOrderToEdit(null);
        setViewingTable(null);
        setTableToPay(null);
        setTableForQr(null);
    };
    const handleSaveTable = (tableData: Omit<Table, 'id'> & { id?: string }) => {
        if (tableData.id) {
            updateTable(tableData as Table);
        } else {
            addTable(tableData);
        }
        fetchDataAndEnrichTables();
        handleCloseModals();
    };
    const handleConfirmDelete = () => {
        if (tableToDelete) {
            deleteTable(tableToDelete.id);
            fetchDataAndEnrichTables();
            handleCloseModals();
        }
    };
    
    // Interactive Buttons Handlers
    const handleOccupy = (tableId: string) => {
        setPreselectedTableIds([tableId]);
        setOrderToEdit(null);
        setIsOrderModalOpen(true);
    };
    const handleFreeUp = (table: EnrichedTable) => {
        table.activeOrdersOnTable?.forEach(order => {
             if (!isOrderFinished(order.status) && order.isPaid) {
                updateOrderStatus(order.id, OrderStatus.COMPLETED_DINE_IN);
            }
        });
        fetchDataAndEnrichTables();
    };
    const handleSaveOrder = async (orderData: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => {
        setIsSavingOrder(true);
        try {
            if (orderData.id) {
                await updateOrder(orderData as Partial<Order> & { id: string });
                toastService.show('Pedido de mesa actualizado.', 'success');
            } else {
                await saveOrder({ ...orderData, createdBy: CreatedBy.ADMIN });
                toastService.show('Pedido de mesa creado.', 'success');
            }
            handleCloseModals();
            fetchDataAndEnrichTables();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al guardar el pedido.';
            toastService.show(message, 'error');
        } finally {
            setIsSavingOrder(false);
        }
    };
    
    const handleModifyOrder = (order: Order) => {
        setOrderToEdit(order);
        setPreselectedTableIds(null);
        setIsOrderModalOpen(true);
    };
    
    const handleNewOrder = (table: EnrichedTable) => {
        setPreselectedTableIds(table.activeOrdersOnTable?.[0]?.tableIds || [table.id]);
        setOrderToEdit(null);
        setIsOrderModalOpen(true);
    };
    
    const handlePay = (table: EnrichedTable) => {
        setTableToPay(table);
        setIsPayModalOpen(true);
    };
    
    const handleConfirmPayment = (paymentMethod: PaymentMethod, paymentProofUrl?: string) => {
        if (tableToPay && tableToPay.activeOrdersOnTable) {
            tableToPay.activeOrdersOnTable.forEach(order => {
                if (!order.isPaid) {
                    markOrderAsPaid(order.id, paymentMethod, paymentProofUrl);
                }
            });
        }
        handleCloseModals();
        fetchDataAndEnrichTables();
    };
    
    const handleSetOverrideStatus = async (tableId: string, status: 'Bloqueada' | null) => {
        setUpdatingStatusTableId(tableId);
        try {
            await setTableOverrideStatus(tableId, status);
            toastService.show(`Mesa ${status === 'Bloqueada' ? 'bloqueada' : 'desbloqueada'}.`, 'success');
            fetchDataAndEnrichTables();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error al actualizar estado.';
            toastService.show(message, 'error');
        } finally {
            setUpdatingStatusTableId(null);
        }
    };

    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Estado de Mesas</h2>
                <button onClick={handleOpenAddModal} className="flex items-center justify-center sm:justify-start bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
                    <PlusIcon className="w-5 h-5 mr-2" /> Agregar Mesa
                </button>
            </div>

            {isLoading ? <p className="dark:text-white">Cargando mesas...</p> : enrichedTables.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                  <LayoutGridIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay mesas configuradas</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Comienza agregando tu primera mesa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {enrichedTables.map(table => (
                        <TableCard
                            key={table.id}
                            table={table}
                            onEdit={() => handleOpenEditModal(table)}
                            onDelete={() => handleOpenDeleteModal(table)}
                            onOccupy={() => handleOccupy(table.id)}
                            onFreeUp={() => handleFreeUp(table)}
                            onViewDetails={() => handleOpenDetailsModal(table)}
                            onModifyOrder={handleModifyOrder}
                            onNewOrder={handleNewOrder}
                            onPay={handlePay}
                            onSetOverrideStatus={handleSetOverrideStatus}
                            onShowQr={() => handleOpenQrModal(table)}
                            isOpen={isOpen}
                            isUpdatingStatus={updatingStatusTableId === table.id}
                        />
                    ))}
                </div>
            )}
            
            <AddEditTableModal isOpen={isAddEditModalOpen} onClose={handleCloseModals} onSave={handleSaveTable} tableToEdit={tableToEdit} />
            <DeleteTableConfirmationModal isOpen={isDeleteModalOpen} onClose={handleCloseModals} onConfirm={handleConfirmDelete} tableName={tableToDelete?.name || ''} />
            <AddOrderModal 
                isOpen={isOrderModalOpen} 
                onClose={handleCloseModals} 
                onSave={handleSaveOrder} 
                preselectedTableIds={preselectedTableIds}
                orderToEdit={orderToEdit}
                isSaving={isSavingOrder} 
                isStoreOpen={isOpen}
            />
            <TableDetailsModal 
                isOpen={isDetailsModalOpen}
                onClose={handleCloseModals}
                table={viewingTable}
            />
            <PayOrderModal
                isOpen={isPayModalOpen}
                onClose={handleCloseModals}
                onConfirm={handleConfirmPayment}
                totalAmount={tableToPay?.accumulatedTotal || 0}
            />
            <QRCodeModal
                isOpen={isQrModalOpen}
                onClose={handleCloseModals}
                table={tableForQr}
            />
        </div>
    );
};

export default TablesPanel;