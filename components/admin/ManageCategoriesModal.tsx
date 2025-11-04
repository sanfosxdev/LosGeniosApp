import React, { useState, useEffect } from 'react';
import type { Category } from '../../types';
import { getCategoriesFromCache, addCategory, updateCategory, deleteCategory } from '../../services/categoryService';
import { CloseIcon } from '../icons/CloseIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import DeleteCategoryConfirmationModal from './DeleteCategoryConfirmationModal';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [color, setColor] = useState('#CCCCCC');
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = !!editingCategory;

  const fetchCategories = () => {
    setCategories(getCategoriesFromCache());
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setImageUrl(category.imageUrl || '');
    setColor(category.color || '#CCCCCC');
    setFormError(null);
  };

  const clearForm = () => {
    setEditingCategory(null);
    setName('');
    setImageUrl('');
    setColor('#CCCCCC');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('El nombre de la categoría no puede estar vacío.');
      return;
    }
    
    if (isEditing && editingCategory) {
      await updateCategory({ ...editingCategory, name, imageUrl, color });
    } else {
      await addCategory({ name, imageUrl, color });
    }
    fetchCategories();
    clearForm();
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
  };

  const handleConfirmDelete = async () => {
    if (categoryToDelete) {
      await deleteCategory(categoryToDelete.id);
      fetchCategories();
      setCategoryToDelete(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
          <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Administrar Categorías</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white">
              <CloseIcon className="w-6 h-6" />
            </button>
          </header>
          
          <div className="flex-grow overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
            {/* Form for Add/Edit */}
            <div className="md:w-1/3">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{isEditing ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                  <input
                    id="cat-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cat-imageUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL de Imagen (Opcional)</label>
                  <input
                    id="cat-imageUrl"
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="cat-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
                  <input
                    id="cat-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mt-1 w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm"
                  />
                </div>
                {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
                <div className="flex items-center gap-2">
                  <button type="submit" className="flex-grow px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700">
                    {isEditing ? 'Guardar Cambios' : 'Agregar Categoría'}
                  </button>
                  {isEditing && (
                    <button type="button" onClick={clearForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List of Categories */}
            <div className="md:w-2/3 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Categorías Existentes</h3>
              <div className="space-y-2">
                {categories.length > 0 ? (
                  categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full border dark:border-gray-600 flex-shrink-0" style={{ backgroundColor: cat.color }}></span>
                        {cat.imageUrl && <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-md object-cover"/>}
                        <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditClick(cat)} className="p-2 text-blue-600 hover:text-blue-900"><EditIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleDeleteClick(cat)} className="p-2 text-red-600 hover:text-red-900"><TrashIcon className="w-5 h-5"/></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No hay categorías.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DeleteCategoryConfirmationModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        categoryName={categoryToDelete?.name || ''}
      />
    </>
  );
};

export default ManageCategoriesModal;