import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { UserRole } from '../../types';
import { CloseIcon } from '../icons/CloseIcon';
import { Spinner } from './Spinner';

interface AddEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<User, 'id' | 'createdAt' | 'lastAccess'> & { id?: string }) => void;
  userToEdit?: User | null;
  isSaving?: boolean;
}

const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, userToEdit, isSaving }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.EDITOR);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const isEditing = !!userToEdit;

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setName(userToEdit.name);
        setEmail(userToEdit.email);
        setRole(userToEdit.role);
      } else {
        setName('');
        setEmail('');
        setRole(UserRole.EDITOR);
      }
      setErrors({});
    }
  }, [isOpen, userToEdit]);

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) newErrors.name = 'El nombre es obligatorio.';
    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'El formato del email no es válido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ id: userToEdit?.id, name, email, role });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform animate-slide-in-up">
        <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white" disabled={isSaving}>
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
              <input
                id="user-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              >
                {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <footer className="flex justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="ml-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 min-w-[150px] flex justify-center items-center disabled:opacity-50 disabled:bg-gray-400"
            >
              {isSaving ? <Spinner /> : (isEditing ? 'Guardar Cambios' : 'Guardar Usuario')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddEditUserModal;