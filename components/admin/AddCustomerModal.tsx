import React, { useState, useEffect } from 'react';
import type { Customer, CustomerCategory } from '../../types';
import { getCustomerCategoriesFromCache as getCustomerCategories } from '../../services/customerCategoryService';
import { CloseIcon } from '../icons/CloseIcon';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => void;
  customerToEdit?: Customer | null;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onSave, customerToEdit }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [errors, setErrors] = useState<{ name?: string, phone?: string; email?: string }>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const isEditing = !!customerToEdit;

  useEffect(() => {
    if (isOpen) {
        const cats = getCustomerCategories();
        setCategories(cats);
        
        if (customerToEdit) {
            setName(customerToEdit.name);
            setPhone(customerToEdit.phone || '');
            setEmail(customerToEdit.email || '');
            setAddress(customerToEdit.address || '');
            setCategoryId(customerToEdit.categoryId);
        } else {
            setName('');
            setPhone('');
            setEmail('');
            setAddress('');
            const newCategory = cats.find(c => c.name === 'Nuevo');
            setCategoryId(newCategory ? newCategory.id : (cats[0]?.id || ''));
        }
        setErrors({});
        setSubmissionError(null);
    }
  }, [customerToEdit, isOpen]);

  const validate = () => {
    const newErrors: { name?: string, phone?: string; email?: string } = {};
    const phoneRegex = /^\d{11,15}$/;

    if (!name.trim()) {
        newErrors.name = 'El nombre es obligatorio.';
    }
    if (!phone.trim()) {
        newErrors.phone = 'El teléfono es obligatorio.';
    } else if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
        newErrors.phone = 'Formato inválido. Solo números, incluir cód. país. Ej: 5493624123456';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
        newErrors.email = 'El email es obligatorio.';
    } else if (!emailRegex.test(email)) {
        newErrors.email = 'Formato de email inválido.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    if (!validate()) {
        return;
    }
    try {
      onSave({
        id: customerToEdit?.id,
        name,
        phone,
        email,
        address,
        categoryId,
      });
    } catch (error) {
       if (error instanceof Error) {
        setSubmissionError(error.message);
      } else {
        setSubmissionError('Ocurrió un error inesperado al guardar el cliente.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'}`}
                required
              />
               {errors.name && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
             <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                required
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'}`}
                placeholder="Ej: 5493624123456"
                required
              />
              {errors.phone && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>
             <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'}`}
                placeholder="ejemplo@correo.com"
                required
              />
              {errors.email && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección (Opcional)</label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="Calle, número, ciudad..."
              />
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
            {submissionError && <p className="text-sm text-red-600 dark:text-red-400 mr-auto">{submissionError}</p>}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              {isEditing ? 'Guardar Cambios' : 'Guardar Cliente'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;