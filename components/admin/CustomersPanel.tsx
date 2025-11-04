import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getCustomersFromCache as getCustomers, addCustomer, updateCustomer, deleteCustomer, importCustomers } from '../../services/customerService';
import { getCustomerCategoriesFromCache as getCustomerCategories } from '../../services/customerCategoryService';
import type { Customer, CustomerCategory, WhatsAppBotStatus, BulkSendJob, Order, Reservation } from '../../types';
import * as whatsAppBotService from '../../services/whatsappBotService';
import Pagination from './Pagination';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import AddCustomerModal from './AddCustomerModal';
import DeleteCustomerConfirmationModal from './DeleteCustomerConfirmationModal';
import { UsersIcon } from '../icons/UsersIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import ManageCustomerCategoriesModal from './ManageCustomerCategoriesModal';
import { UploadIcon } from '../icons/UploadIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { SendIcon } from '../icons/SendIcon';
import SendToCustomerModal from './SendToCustomerModal';
import { CloseIcon } from '../icons/CloseIcon';
import { MessageSquareIcon } from '../icons/MessageSquareIcon';
import SendMessageModal from './SendMessageModal';
import BulkSendStatus from './BulkSendStatus';
import SendToGroupModal from './SendToGroupModal';
import CustomerDetailsPanel from './CustomerDetailsPanel';
import { getOrdersFromCache as getOrders } from '../../services/orderService';
import { getReservationsFromCache as getReservations } from '../../services/reservationService';


const ITEMS_PER_PAGE = 10;

interface CustomersPanelProps {
    whatsAppStatus: WhatsAppBotStatus;
    bulkSendJob: BulkSendJob | null;
    setBulkSendJob: React.Dispatch<React.SetStateAction<BulkSendJob | null>>;
    dataTimestamp: number;
}

const getContrastColor = (hexColor: string): string => {
  if (!hexColor) return '#000000';
  if (hexColor.indexOf('#') === 0) {
      hexColor = hexColor.slice(1);
  }
  if (hexColor.length === 3) {
      hexColor = hexColor.split('').map(function (hex) {
          return hex + hex;
      }).join('');
  }
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);
  const brightness = Math.round(((r * 299) + (g * 587) + (b * 114)) / 1000);
  return (brightness > 125) ? '#000000' : '#FFFFFF';
};

const CustomersPanel: React.FC<CustomersPanelProps> = ({ whatsAppStatus, bulkSendJob, setBulkSendJob, dataTimestamp }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSendMessageModalOpen, setIsSendMessageModalOpen] = useState(false);
  const [isSendToGroupModalOpen, setIsSendToGroupModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [customerToSendTo, setCustomerToSendTo] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const bulkSendJobRef = useRef(bulkSendJob);
  bulkSendJobRef.current = bulkSendJob;

  const fetchAllData = useCallback(() => {
    setIsLoading(true);
    setCustomers(getCustomers());
    setCategories(getCustomerCategories());
    setAllOrders(getOrders());
    setAllReservations(getReservations());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [dataTimestamp, fetchAllData]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesCategory = selectedCategory === 'all' || customer.categoryId === selectedCategory;
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = 
        customer.name.toLowerCase().includes(searchTermLower) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.email && customer.email.toLowerCase().includes(searchTermLower));
      return matchesCategory && matchesSearch;
    });
  }, [customers, searchTerm, selectedCategory]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  
  const handleViewCustomerDetails = (customer: Customer) => {
    setViewingCustomer(customer);
  };

  const handleCloseCustomerDetails = () => {
    setViewingCustomer(null);
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsAddEditModalOpen(true);
  };

  const handleOpenDeleteModal = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteModalOpen(true);
  };

  const handleOpenSendModal = (customer: Customer) => {
    setCustomerToSendTo(customer);
    setIsSendModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsCategoriesModalOpen(false);
    setIsSendModalOpen(false);
    setIsSendMessageModalOpen(false);
    setIsSendToGroupModalOpen(false);
    setEditingCustomer(null);
    setCustomerToDelete(null);
    setCustomerToSendTo(null);
  };

  const handleSaveCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => {
    if (customerData.id) {
      await updateCustomer(customerData as Customer);
    } else {
      await addCustomer(customerData);
    }
    fetchAllData();
    handleCloseModals();
  };

  const handleConfirmDelete = async () => {
    if (customerToDelete) {
      await deleteCustomer(customerToDelete.id);
      fetchAllData();
      handleCloseModals();
    }
  };
  
  const handleCancelSend = () => {
    if (bulkSendJobRef.current) {
        setBulkSendJob(prev => prev ? { ...prev, isCancelled: true } : null);
    }
  };

  const handleStartSend = async (phones: string[], content: string, mediaUrl?: string) => {
      setIsSendMessageModalOpen(false);

      if (phones.length === 0) {
          setNotification({ message: 'No se encontraron clientes con números de teléfono válidos para el envío.', type: 'error' });
          return;
      }

      if (phones.length <= 5) {
          setNotification({ message: `Enviando ${phones.length} mensajes...`, type: 'success' });
          const results = await Promise.all(phones.map(phone => whatsAppBotService.sendWhatsAppMessage(phone, content, mediaUrl)));
          const failedCount = results.filter(r => !r.success).length;
          if (failedCount > 0) {
              setNotification({ message: `Envío completado con ${failedCount} errores.`, type: 'error' });
          } else {
              setNotification({ message: 'Todos los mensajes enviados con éxito.', type: 'success' });
          }
      } else {
          const newJob: BulkSendJob = {
              status: 'running',
              total: phones.length,
              sent: 0,
              failed: 0,
              startTime: Date.now(),
              isCancelled: false,
          };
          setBulkSendJob(newJob);

          (async () => {
              for (const phone of phones) {
                  if (bulkSendJobRef.current?.isCancelled) {
                      setBulkSendJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
                      return;
                  }

                  const result = await whatsAppBotService.sendWhatsAppMessage(phone, content, mediaUrl);
                  
                  setBulkSendJob(prev => {
                      if (!prev) return null;
                      return {
                          ...prev,
                          sent: prev.sent + 1,
                          failed: prev.failed + (result.success ? 0 : 1),
                      };
                  });
                  await new Promise(resolve => setTimeout(resolve, 500)); 
              }
              setBulkSendJob(prev => prev ? { ...prev, status: 'completed' } : null);
          })();
      }
  };

  const handleSendToGroup = async (groupId: string, content: string, mediaUrl?: string) => {
    setIsSendToGroupModalOpen(false);
    setNotification({ message: `Enviando mensaje al grupo...`, type: 'success' });
    const result = await whatsAppBotService.sendWhatsAppGroupMessage(groupId, content, mediaUrl);
    if (result.success) {
      setNotification({ message: 'Mensaje de grupo enviado con éxito.', type: 'success' });
    } else {
      setNotification({ message: `Error al enviar mensaje de grupo: ${result.error}`, type: 'error' });
    }
  };


  const handleExport = () => {
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Nombre,Teléfono,Email,Dirección,Categoría\n"
        + customers.map(c => `"${c.name}","${c.phone || ''}","${c.email || ''}","${c.address || ''}","${categoryMap.get(c.categoryId) || 'Sin categoría'}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].trim().split(',').map(h => h.trim());
        
        const keyMap: { [key: string]: string } = {
            'Nombre': 'name', 'Teléfono': 'phone', 'Email': 'email', 'Dirección': 'address', 'Categoría': 'categoryName'
        };

        const customersToImport = lines.slice(1).map(line => {
            if (!line.trim()) return null;
            const values = line.split(',');
            const customerData: any = {};
            headers.forEach((header, index) => {
                const key = keyMap[header];
                if (key) {
                    customerData[key] = values[index]?.trim().replace(/"/g, '');
                }
            });
            return customerData;
        }).filter(c => c && c.name);

        if (customersToImport.length > 0) {
            const result = await importCustomers(customersToImport);
            setNotification({
              message: `Importación completada: ${result.added} agregados, ${result.updated} actualizados, ${result.errors} errores.`,
              type: result.errors > 0 ? 'error' : 'success'
            });
            fetchAllData();
        } else {
            setNotification({ message: 'No se encontraron clientes válidos para importar en el archivo.', type: 'error' });
        }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const getCategoryName = (categoryId: string) => {
      return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
  };

  if (viewingCustomer) {
    const customerOrders = allOrders.filter(o => o.customer.phone === viewingCustomer.phone || o.customer.name === viewingCustomer.name);
    const customerReservations = allReservations.filter(r => r.customerPhone === viewingCustomer.phone || r.customerName === viewingCustomer.name);

    return (
      <CustomerDetailsPanel
        customer={viewingCustomer}
        orders={customerOrders}
        reservations={customerReservations}
        onClose={handleCloseCustomerDetails}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Clientes</h2>
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
            {whatsAppStatus === 'active' && (
                <>
                    <button
                        onClick={() => setIsSendMessageModalOpen(true)}
                        disabled={!!bulkSendJob && bulkSendJob.status === 'running'}
                        className="flex items-center justify-center bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <MessageSquareIcon className="w-5 h-5 mr-2" />
                        Enviar Mensaje
                    </button>
                    <button
                        onClick={() => setIsSendToGroupModalOpen(true)}
                        disabled={!!bulkSendJob && bulkSendJob.status === 'running'}
                        className="flex items-center justify-center bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <UsersIcon className="w-5 h-5 mr-2" />
                        Enviar a Grupo
                    </button>
                </>
            )}
           <button onClick={() => importInputRef.current?.click()} className="flex items-center justify-center bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                <UploadIcon className="w-5 h-5 mr-2" />
                Importar
            </button>
            <input type="file" ref={importInputRef} onChange={handleImport} className="hidden" accept=".csv" />
            <button onClick={handleExport} className="flex items-center justify-center bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                <DownloadIcon className="w-5 h-5 mr-2" />
                Exportar
            </button>
           <button
                onClick={() => setIsCategoriesModalOpen(true)}
                className="flex items-center justify-center sm:justify-start bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
                <SettingsIcon className="w-5 h-5 mr-2" />
                Categorías
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center justify-center sm:justify-start bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Agregar Cliente
            </button>
        </div>
      </div>

      {notification && (
        <div className={`border px-4 py-3 rounded-lg relative mb-4 animate-fade-in ${notification.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`} role="alert">
            <span className="block sm:inline">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>
      )}

      {bulkSendJob && bulkSendJob.status !== 'idle' && (
        <div className="mb-4">
            <BulkSendStatus
                job={bulkSendJob}
                onCancel={handleCancelSend}
                onClose={() => setBulkSendJob(null)}
            />
        </div>
      )}

      {isLoading ? (
        <p>Cargando clientes...</p>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <UsersIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay clientes registrados</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Comienza agregando tu primer cliente.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {filteredCustomers.length === 0 ? (
             <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <UsersIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No se encontraron clientes</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Intenta ajustar los filtros de búsqueda.</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto responsive-table">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Teléfono</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dirección</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha de Registro</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td data-label="Nombre" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            <button onClick={() => handleViewCustomerDetails(customer)} className="text-left text-blue-600 dark:text-blue-400 hover:underline">
                                {customer.name}
                            </button>
                        </td>
                        <td data-label="Categoría" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {(() => {
                            const category = categories.find(c => c.id === customer.categoryId);
                            const bgColor = category?.color || '#E5E7EB';
                            const textColor = getContrastColor(bgColor);
                            return (
                              <span style={{ backgroundColor: bgColor, color: textColor }} className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                  {getCategoryName(customer.categoryId)}
                              </span>
                            );
                          })()}
                        </td>
                        <td data-label="Teléfono" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{customer.phone || 'N/A'}</td>
                        <td data-label="Email" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{customer.email || 'N/A'}</td>
                        <td data-label="Dirección" className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400 max-w-xs">{customer.address || 'N/A'}</td>
                        <td data-label="Fecha de Registro" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(customer.createdAt).toLocaleDateString('es-AR')}</td>
                        <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center space-x-4">
                            <button onClick={() => handleOpenSendModal(customer)} className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300" aria-label={`Enviar a ${customer.name}`}>
                              <SendIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleOpenEditModal(customer)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300" aria-label={`Editar ${customer.name}`}>
                              <EditIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleOpenDeleteModal(customer)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Eliminar ${customer.name}`}>
                              <TrashIcon className="w-5 h-5" />
                            </button>
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
        </>
      )}

      <AddCustomerModal
        isOpen={isAddEditModalOpen}
        onClose={handleCloseModals}
        onSave={handleSaveCustomer}
        customerToEdit={editingCustomer}
      />

      <DeleteCustomerConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseModals}
        onConfirm={handleConfirmDelete}
        customerName={customerToDelete?.name || ''}
      />

      <ManageCustomerCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => {
            setIsCategoriesModalOpen(false);
            fetchAllData();
        }}
      />

      <SendToCustomerModal
        isOpen={isSendModalOpen}
        onClose={handleCloseModals}
        customer={customerToSendTo}
      />

      <SendMessageModal
        isOpen={isSendMessageModalOpen}
        onClose={handleCloseModals}
        onSend={handleStartSend}
        customers={customers}
        categories={categories}
      />

      <SendToGroupModal
        isOpen={isSendToGroupModalOpen}
        onClose={handleCloseModals}
        onSend={handleSendToGroup}
      />
    </div>
  );
};

export default CustomersPanel;
