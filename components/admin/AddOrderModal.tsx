import React, { useState, useEffect, useMemo } from 'react';
import type { Order, OrderItem, Product, Table, Customer, Reservation, Promotion } from '../../types';
import { OrderType, PaymentMethod } from '../../types';
import { getProductsFromCache as getProducts } from '../../services/productService';
import { getPromotionsFromCache as getPromotions } from '../../services/promotionService';
import { getTablesFromCache as getTables, getAvailableTablesForDineIn } from '../../services/tableService';
import { getCustomersFromCache as getCustomers } from '../../services/customerService';
import { CloseIcon } from '../icons/CloseIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { Spinner } from './Spinner';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Omit<Order, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt' | 'isPaid' | 'createdBy'> & { id?: string }) => void;
  orderToEdit?: Order | null;
  preselectedTableIds?: string[] | null;
  reservationToConvert?: Reservation | null;
  isSaving?: boolean;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

const findTableCombination = (availableTables: Table[], guests: number): Table[] | null => {
    // 1. Try to find a single table that fits
    const singleFit = availableTables
        .filter(t => t.capacity >= guests)
        .sort((a, b) => a.capacity - b.capacity)[0];
    if (singleFit) {
        return [singleFit];
    }
    
    // 2. If no single table fits, try a greedy approach for a combination
    const sortedTables = [...availableTables].sort((a, b) => b.capacity - a.capacity); // Descending capacity
    const selectedTables: Table[] = [];
    let currentCapacity = 0;
    
    for (const table of sortedTables) {
        if (currentCapacity < guests) {
            selectedTables.push(table);
            currentCapacity += table.capacity;
        }
    }

    if (currentCapacity >= guests) {
        return selectedTables;
    }

    return null; // No combination found
}

const AddOrderModal: React.FC<AddOrderModalProps> = ({ isOpen, onClose, onSave, orderToEdit, preselectedTableIds, reservationToConvert, isSaving }) => {
  // State variables
  const [customer, setCustomer] = useState<{ name: string; phone?: string; address?: string; }>({ name: '', phone: '', address: '' });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.PICKUP);
  const [guests, setGuests] = useState(1);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  
  // Data lists
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Control state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new_customer');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = !!orderToEdit;
  const isConvertingReservation = !!reservationToConvert;

  useEffect(() => {
    if (isOpen) {
      // Fetch all necessary data
      setProducts(getProducts());
      setPromotions(getPromotions().filter(p => p.isActive));
      setAllTables(getTables());
      setCustomers(getCustomers());
      setSubmissionError(null);

      if (reservationToConvert) {
        setOrderType(OrderType.DINE_IN);
        setSelectedCustomerId(''); 
        setCustomer({ name: reservationToConvert.customerName, phone: reservationToConvert.customerPhone || '' });
        setItems([]);
        setGuests(reservationToConvert.guests);
        setTableIds(reservationToConvert.tableIds);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else if (orderToEdit) {
        setOrderType(orderToEdit.type);
        const existingCustomer = getCustomers().find(c => c.name === orderToEdit.customer.name && c.phone === orderToEdit.customer.phone);
        setSelectedCustomerId(existingCustomer ? existingCustomer.id : 'new_customer');
        setCustomer(orderToEdit.customer);
        setItems(orderToEdit.items);
        setGuests(orderToEdit.guests || 1);
        setTableIds(orderToEdit.tableIds || []);
        setPaymentMethod(orderToEdit.paymentMethod || PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else if (preselectedTableIds) {
        setOrderType(OrderType.DINE_IN);
        setSelectedCustomerId('new_customer');
        setCustomer({ name: '', phone: '', address: '' });
        setItems([]);
        setGuests(1);
        setTableIds(preselectedTableIds);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      } else {
        setOrderType(OrderType.PICKUP);
        setSelectedCustomerId('new_customer');
        setCustomer({ name: '', phone: '', address: '' });
        setItems([]);
        setGuests(1);
        setTableIds([]);
        setPaymentMethod(PaymentMethod.CASH);
        setPaymentProofFile(null);
      }
    }
  }, [isOpen, orderToEdit, preselectedTableIds, reservationToConvert]);
  
  useEffect(() => {
    if (orderType === OrderType.DELIVERY) {
        setPaymentMethod(PaymentMethod.TRANSFER);
    } else if (orderType !== OrderType.DINE_IN) {
        setPaymentMethod(PaymentMethod.CASH);
    }
  }, [orderType]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === 'new_customer') {
        setCustomer({ name: '', phone: '', address: '' });
    } else {
        const selected = customers.find(c => c.id === customerId);
        if (selected) {
            setCustomer({
                name: selected.name,
                phone: selected.phone || '',
                address: selected.address || '',
            });
        }
    }
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomer({ ...customer, [e.target.name]: e.target.value });
    setSelectedCustomerId('new_customer'); // When user types, it becomes a custom entry
  };
  
  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as OrderType;
    setOrderType(newType);
    if (newType !== OrderType.DELIVERY) {
      setCustomer(c => ({ ...c, address: '' }));
    }
    if (newType !== OrderType.DINE_IN) {
      setTableIds([]);
      setGuests(1);
    } else {
      setSelectedCustomerId('new_customer');
      setCustomer({ name: '', phone: '', address: '' });
    }
  };

  const handleAddProduct = () => {
    if (products.length > 0) {
      const firstProduct = products[0];
      setItems([...items, { name: firstProduct.name, quantity: 1, price: Number(firstProduct.price), isPromotion: false, itemId: firstProduct.id }]);
    }
  };
  
  const handleAddPromotion = () => {
    if (promotions.length > 0) {
      const firstPromo = promotions[0];
      setItems([...items, { name: firstPromo.name, quantity: 1, price: firstPromo.price, isPromotion: true, itemId: firstPromo.id }]);
    }
  };

  const handleItemChange = (index: number, field: 'name' | 'quantity', value: string | number) => {
    const newItems = [...items];
    const currentItem = newItems[index];

    if (field === 'name') {
        if(currentItem.isPromotion) {
            const selectedPromotion = promotions.find(p => p.name === value);
            if(selectedPromotion) {
                newItems[index] = { ...newItems[index], name: selectedPromotion.name, price: selectedPromotion.price, itemId: selectedPromotion.id };
            }
        } else {
            const selectedProduct = products.find(p => p.name === value);
            if(selectedProduct) {
                newItems[index] = { ...newItems[index], name: selectedProduct.name, price: Number(selectedProduct.price), itemId: selectedProduct.id };
            }
        }
    } else { // quantity
        newItems[index] = { ...newItems[index], [field]: Number(value) };
    }
    setItems(newItems);
  };
  
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    if (!isConvertingReservation && orderType !== OrderType.DINE_IN && !customer.name) {
      setSubmissionError('Por favor, ingresa el nombre del cliente.');
      return;
    }
     if (items.length === 0) {
      setSubmissionError('Por favor, agrega al menos un artículo.');
      return;
    }

    // Check for reservation conversion
    if (isConvertingReservation && reservationToConvert) {
        const availableTables = getAvailableTablesForDineIn(reservationToConvert.id);
        const availableTableIds = new Set(availableTables.map(t => t.id));
        const allReservedTablesAreAvailable = reservationToConvert.tableIds.every(id => availableTableIds.has(id));

        if (!allReservedTablesAreAvailable) {
            setSubmissionError('Una o más mesas de esta reserva ya no están disponibles. Libera la mesa primero.');
            return;
        }
    }
    
    // Check for pre-selected tables from TablesPanel
    if (!isEditing && !isConvertingReservation && preselectedTableIds && preselectedTableIds.length > 0) {
        const availableTables = getAvailableTablesForDineIn();
        const availableTableIds = new Set(availableTables.map(t => t.id));
        const allPreselectedTablesAreAvailable = preselectedTableIds.every(id => availableTableIds.has(id));

        if (!allPreselectedTablesAreAvailable) {
            setSubmissionError('La mesa seleccionada ya no está disponible. Refresca el panel y vuelve a intentarlo.');
            return;
        }
    }

    let finalTableIds = tableIds;
    if (orderType === OrderType.DINE_IN && !isEditing && !isConvertingReservation && (!preselectedTableIds || preselectedTableIds.length === 0)) {
        if (guests <= 0) {
            setSubmissionError('El número de comensales debe ser mayor a 0.');
            return;
        }
        const availableTables = getAvailableTablesForDineIn();
        const foundCombination = findTableCombination(availableTables, guests);
        if (!foundCombination) {
            setSubmissionError('No hay mesas disponibles para el número de comensales especificado.');
            return;
        }
        finalTableIds = foundCombination.map(t => t.id);
    }
    
    let paymentProofUrl: string | null | undefined = orderToEdit?.paymentProofUrl;
    if (paymentProofFile) {
        paymentProofUrl = await fileToDataUrl(paymentProofFile);
    }
    
    const finalCustomerName = (orderType === OrderType.DINE_IN && !customer.name.trim() && finalTableIds.length > 0)
      ? `Mesa ${allTables.find(t => t.id === finalTableIds[0])?.name || ''}`
      : customer.name;

    const orderData = {
      id: orderToEdit?.id,
      customer: {
        ...customer,
        name: finalCustomerName,
      },
      items,
      total,
      type: orderType,
      tableIds: orderType === OrderType.DINE_IN ? finalTableIds : undefined,
      guests: orderType === OrderType.DINE_IN ? guests : undefined,
      paymentMethod: orderType === OrderType.DINE_IN && !isEditing ? PaymentMethod.CASH : paymentMethod,
      paymentProofUrl,
      reservationId: reservationToConvert?.id,
    };
    onSave(orderData);
  };
  
  const assignedTableNames = useMemo(() => {
      if (orderType !== OrderType.DINE_IN || !tableIds || tableIds.length === 0) return 'Se asignará automáticamente';
      return tableIds.map(id => allTables.find(t => t.id === id)?.name || id).join(', ');
  }, [orderType, tableIds, allTables]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Pedido' : isConvertingReservation ? 'Crear Pedido para Reserva' : 'Agregar Nuevo Pedido'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* 1. Delivery Method */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-md">
                <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Forma de Entrega</legend>
                 <div className="mt-2 text-gray-800 dark:text-gray-200">
                    <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.PICKUP} checked={orderType === OrderType.PICKUP} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>Retira de Local</label>
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.DELIVERY} checked={orderType === OrderType.DELIVERY} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>Envío a Domicilio</label>
                        <label className="flex items-center"><input type="radio" name="orderType" value={OrderType.DINE_IN} checked={orderType === OrderType.DINE_IN} onChange={handleTypeChange} disabled={isConvertingReservation || isEditing} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>En Mesa</label>
                    </div>
                </div>
                {orderType === OrderType.DELIVERY && (
                  <div className="mt-4 animate-fade-in">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección de Envío</label>
                      <input id="address" name="address" value={customer.address || ''} onChange={handleCustomerChange} placeholder="Calle, número, ciudad" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required/>
                  </div>
                )}
                 {orderType === OrderType.DINE_IN && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    <div>
                        <label htmlFor="guests" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comensales</label>
                        <input id="guests" name="guests" type="number" value={guests} onChange={(e) => setGuests(Number(e.target.value))} min="1" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required disabled={isConvertingReservation || isEditing}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mesa(s) Asignada(s)</label>
                        <div className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 rounded-md text-gray-600 dark:text-gray-400 min-h-[42px] flex items-center">
                            {assignedTableNames}
                        </div>
                    </div>
                  </div>
                )}
            </fieldset>

            {/* 2. Customer Details */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-md">
              <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Detalles del Cliente</legend>
              <div className="mt-2 space-y-4">
                  {orderType === OrderType.DINE_IN ? (
                     <div className="animate-fade-in">
                        {isConvertingReservation ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Creando pedido para la reserva de <strong className="dark:text-white">{customer.name}</strong>.</p>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Para pedidos en mesa, se registra como cliente ocasional. Puedes añadir un nombre de referencia si lo deseas.</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" value={customer.name || ''} onChange={handleCustomerChange} placeholder="Nombre (Opcional)" disabled={isConvertingReservation} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"/>
                            <input name="phone" value={customer.phone || ''} onChange={handleCustomerChange} placeholder="Teléfono (Opcional)" disabled={isConvertingReservation} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"/>
                        </div>
                    </div>
                  ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                            <select value={selectedCustomerId} onChange={e => handleCustomerSelect(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                                <option value="new_customer">-- Nuevo Cliente --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" value={customer.name || ''} onChange={handleCustomerChange} placeholder="Nombre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary" required/>
                            <input name="phone" value={customer.phone || ''} onChange={handleCustomerChange} placeholder="Teléfono" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                        </div>
                    </>
                  )}
              </div>
            </fieldset>

            {/* 3. Order Items */}
            <fieldset className="border dark:border-gray-600 p-4 rounded-md">
                <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Artículos del Pedido</legend>
                <div className="space-y-3 mt-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="relative w-full sm:flex-1">
                                <select
                                    value={item.name}
                                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                    className="w-full appearance-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary transition-colors"
                                >
                                    {item.isPromotion 
                                        ? promotions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                                        : products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)
                                    }
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                    <ChevronDownIcon className="h-5 w-5" />
                                </div>
                            </div>
                            <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                min="1"
                                className="w-full sm:w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm text-center focus:outline-none focus:ring-primary focus:border-primary transition-colors"
                            />
                            <span className="w-full sm:w-24 text-center sm:text-right font-medium text-gray-700 dark:text-gray-300">${(item.price * item.quantity).toLocaleString('es-AR')}</span>
                            <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={handleAddProduct} className="mt-4 flex items-center text-primary font-semibold hover:underline">
                    <PlusIcon className="w-5 h-5 mr-1"/> Agregar Producto
                  </button>
                   <button type="button" onClick={handleAddPromotion} className="mt-4 flex items-center text-primary font-semibold hover:underline">
                    <PlusIcon className="w-5 h-5 mr-1"/> Agregar Promoción
                  </button>
                </div>
            </fieldset>
            
            {/* 4. Payment and Total */}
            {orderType !== OrderType.DINE_IN && (
                <fieldset className="border dark:border-gray-600 p-4 rounded-md">
                    <legend className="text-lg font-semibold px-2 text-gray-700 dark:text-gray-200">Pago</legend>
                    <div className="mt-2 text-gray-800 dark:text-gray-200">
                        <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                            <label className="flex items-center">
                                <input type="radio" name="paymentMethod" value={PaymentMethod.CASH} checked={paymentMethod === PaymentMethod.CASH} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} disabled={orderType === OrderType.DELIVERY} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>
                                Efectivo
                            </label>
                            <label className="flex items-center">
                                <input type="radio" name="paymentMethod" value={PaymentMethod.CREDIT} checked={paymentMethod === PaymentMethod.CREDIT} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} disabled={orderType === OrderType.DELIVERY} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>
                                Crédito
                            </label>
                            <label className="flex items-center">
                                <input type="radio" name="paymentMethod" value={PaymentMethod.TRANSFER} checked={paymentMethod === PaymentMethod.TRANSFER} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-500"/>
                                Transferencia
                            </label>
                        </div>
                    </div>
                    {paymentMethod === PaymentMethod.TRANSFER && (
                        <div className="mt-4 p-4 border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 animate-fade-in">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-300">Datos para la Transferencia</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                <strong>CBU:</strong> 1234567890123456789012<br/>
                                <strong>Alias:</strong> PIZZERIA.LOS.GENIOS
                            </p>
                            <div className="mt-3">
                                <label htmlFor="paymentProof" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subir Comprobante (Opcional)</label>
                                <input type="file" id="paymentProof" onChange={handleFileChange} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                            </div>
                        </div>
                    )}
                </fieldset>
            )}

            <div className="text-right">
                <span className="text-gray-600 dark:text-gray-400 font-semibold">Total del Pedido:</span>
                <span className="ml-2 text-2xl font-bold text-primary">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg sticky bottom-0">
            {submissionError && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{submissionError}</p>}
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
            <button type="submit" disabled={isSaving} className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 min-w-[150px] flex justify-center items-center disabled:opacity-50">
              {isSaving ? <Spinner /> : (isEditing ? 'Guardar Cambios' : 'Guardar Pedido')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddOrderModal;