import React, { useState, useEffect } from 'react';
import type { Promotion, PromotionItem, Product } from '../../types';
import { getPromotionsFromCache as getPromotions, addPromotion, updatePromotion, deletePromotion } from '../../services/promotionService';
import { getProductsFromCache as getProducts } from '../../services/productService';
import { CloseIcon } from '../icons/CloseIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { PlusIcon } from '../icons/PlusIcon';
import DeletePromotionConfirmationModal from './DeletePromotionConfirmationModal';

interface ManagePromotionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManagePromotionsModal: React.FC<ManagePromotionsModalProps> = ({ isOpen, onClose }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<PromotionItem[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  
  const isEditing = !!editingPromotion;

  const fetchAllData = () => {
    setPromotions(getPromotions());
    setProducts(getProducts());
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllData();
      clearForm();
    }
  }, [isOpen]);

  const handleEditClick = (promo: Promotion) => {
    setEditingPromotion(promo);
    setName(promo.name);
    setPrice(promo.price);
    setIsActive(promo.isActive);
    setItems(promo.items);
    setImageUrl(promo.imageUrl || '');
  };

  const clearForm = () => {
    setEditingPromotion(null);
    setName('');
    setPrice(0);
    setIsActive(true);
    setItems([]);
    setImageUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || items.length === 0 || price <= 0) {
      alert('Completa el nombre, agrega al menos un producto y establece un precio mayor a cero.');
      return;
    }
    
    const promotionData: Omit<Promotion, 'id' | 'createdAt'> = { name, price, isActive, items, imageUrl };
    
    if (isEditing && editingPromotion) {
      updatePromotion({ ...promotionData, id: editingPromotion.id, createdAt: editingPromotion.createdAt });
    } else {
      addPromotion(promotionData);
    }
    fetchAllData();
    clearForm();
  };
  
  const handleItemChange = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const newItems = [...items];
    const currentItem = newItems[index];
    
    if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
            newItems[index] = { ...currentItem, productId: product.id, name: product.name };
        }
    } else {
        newItems[index] = { ...currentItem, quantity: Number(value) >= 1 ? Number(value) : 1 };
    }
    setItems(newItems);
  };
  
  const handleAddItem = () => {
    if (products.length > 0) {
      setItems([...items, { productId: products[0].id, name: products[0].name, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleDeleteClick = (promo: Promotion) => {
    setPromotionToDelete(promo);
  };
  
  const handleConfirmDelete = () => {
    if(promotionToDelete) {
        deletePromotion(promotionToDelete.id);
        fetchAllData();
        setPromotionToDelete(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
          <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Administrar Promociones</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
          </header>
          
          <div className="flex-grow overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
            <div className="md:w-2/5">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{isEditing ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                </div>
                
                <div className="space-y-2 p-3 border dark:border-gray-600 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Productos Incluidos</label>
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                           <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="flex-grow px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm">
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                           <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="1" className="w-16 text-center px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
                           <button type="button" onClick={() => handleRemoveItem(index)} className="p-1 text-red-500"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ))}
                    <button type="button" onClick={handleAddItem} className="text-sm text-primary flex items-center"><PlusIcon className="w-4 h-4 mr-1"/>Agregar Producto</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio</label>
                      <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min="0" className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" required />
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                       <div className="mt-2">
                           <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 text-primary rounded border-gray-300 focus:ring-primary" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{isActive ? 'Activa' : 'Inactiva'}</span>
                            </label>
                       </div>
                    </div>
                </div>
                
                 <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL de Imagen (Opcional)</label>
                  <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.jpg" className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" className="flex-grow px-4 py-2 text-white bg-primary rounded-md">{isEditing ? 'Guardar Cambios' : 'Agregar'}</button>
                  {isEditing && <button type="button" onClick={clearForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>}
                </div>
              </form>
            </div>
            
            <div className="md:w-3/5 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Promociones Existentes</h3>
              <div className="space-y-2">
                {promotions.length > 0 ? promotions.map(promo => (
                    <div key={promo.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            {promo.imageUrl && <img src={promo.imageUrl} alt={promo.name} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{promo.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {promo.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                                 <div className="mt-2 flex items-center gap-2">
                                   <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${promo.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>{promo.isActive ? 'Activa' : 'Inactiva'}</span>
                                   <span className="font-bold text-primary">${promo.price.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleEditClick(promo)} className="p-2 text-blue-600"><EditIcon className="w-5 h-5"/></button>
                            <button onClick={() => handleDeleteClick(promo)} className="p-2 text-red-600"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-gray-500 dark:text-gray-400">No hay promociones creadas.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DeletePromotionConfirmationModal isOpen={!!promotionToDelete} onClose={() => setPromotionToDelete(null)} onConfirm={handleConfirmDelete} promotionName={promotionToDelete?.name || ''} />
    </>
  );
};

export default ManagePromotionsModal;