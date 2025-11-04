import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShoppingBagIcon } from '../icons/ShoppingBagIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { EditIcon } from '../icons/EditIcon';
import { TrashIcon } from '../icons/TrashIcon';
import AddProductModal from './AddProductModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { getProductsFromCache as getProducts, addProduct, updateProduct, deleteProduct, adjustProductPrices, importProducts } from '../../services/productService';
import { getCategoriesFromCache as getCategories } from '../../services/categoryService';
import type { Product, Category } from '../../types';
import Pagination from './Pagination';
import { SettingsIcon } from '../icons/SettingsIcon';
import ManageCategoriesModal from './ManageCategoriesModal';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import AdjustPricesModal from './AdjustPricesModal';
import { MegaphoneIcon } from '../icons/MegaphoneIcon';
import PromoteProductModal from './PromoteProductModal';
import { GiftIcon } from '../icons/GiftIcon';
import ManagePromotionsModal from './ManagePromotionsModal';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { CloseIcon } from '../icons/CloseIcon';

const ITEMS_PER_PAGE = 10;

interface ProductsPanelProps {
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

const ProductsPanel: React.FC<ProductsPanelProps> = ({ dataTimestamp }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isAdjustPricesModalOpen, setIsAdjustPricesModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [productToPromote, setProductToPromote] = useState<Product | null>(null);
  const [isPromotionsModalOpen, setIsPromotionsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fetchProductsAndCategories = useCallback(() => {
    setIsLoading(true);
    setProducts(getProducts());
    setCategories(getCategories());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProductsAndCategories();
  }, [dataTimestamp, fetchProductsAndCategories]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsAddEditModalOpen(true);
  };

  const handleOpenDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleOpenPromoteModal = (product: Product) => {
    setProductToPromote(product);
    setIsPromoteModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsCategoriesModalOpen(false);
    setIsAdjustPricesModalOpen(false);
    setIsPromoteModalOpen(false);
    setIsPromotionsModalOpen(false);
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id'> & { id?: string }) => {
    if (productData.id) {
      await updateProduct(productData as Product);
    } else {
      await addProduct(productData);
    }
    fetchProductsAndCategories();
    handleCloseModals();
  };

  const handleConfirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id);
      fetchProductsAndCategories();
      handleCloseModals();
    }
  };
  
  const handleConfirmAdjustPrices = async (targetCategory: string, percentage: number, rounding: 'none' | 'integer' | '10' | '50' | '100') => {
    await adjustProductPrices(targetCategory, percentage, rounding);
    fetchProductsAndCategories();
    handleCloseModals();
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Nombre,Categoria,Precio,Descripcion\n"
        + products.map(p => `"${p.name}","${p.category}","${p.price}","${p.description || ''}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "productos.csv");
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
        
        const keyMap: { [key: string]: keyof Omit<Product, 'id' | 'imageUrl'> } = {
            'Nombre': 'name', 'Categoria': 'category', 'Precio': 'price', 'Descripcion': 'description'
        };

        const productsToImport = lines.slice(1).map(line => {
            if (!line.trim()) return null;
            const values = line.split(',');
            const productData: any = {};
            headers.forEach((header, index) => {
                const key = keyMap[header];
                if (key) {
                    productData[key] = values[index]?.trim().replace(/"/g, '');
                }
            });
            return productData;
        }).filter(p => p && p.name && p.category && p.price);

        if (productsToImport.length > 0) {
            const result = await importProducts(productsToImport);
            setNotification({
              message: `Importación completada: ${result.added} agregados, ${result.updated} actualizados, ${result.errors} errores.`,
              type: result.errors > 0 ? 'error' : 'success'
            });
            fetchProductsAndCategories();
        } else {
            setNotification({ message: 'No se encontraron productos válidos para importar en el archivo.', type: 'error' });
        }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = ''; // Reset file input
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Productos</h2>
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
            <button onClick={() => importInputRef.current?.click()} className="flex items-center justify-center bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                <UploadIcon className="w-5 h-5 mr-2" />
                Importar
            </button>
            <input type="file" ref={importInputRef} onChange={handleImport} className="hidden" accept=".csv" />
            <button onClick={handleExport} className="flex items-center justify-center bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                <DownloadIcon className="w-5 h-5 mr-2" />
                Exportar
            </button>
             <button onClick={() => setIsPromotionsModalOpen(true)} className="flex items-center justify-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors">
                <GiftIcon className="w-5 h-5 mr-2" />
                Promociones
            </button>
            <button onClick={() => setIsAdjustPricesModalOpen(true)} className="flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                <TrendingUpIcon className="w-5 h-5 mr-2" />
                Ajustar Precios
            </button>
            <button onClick={() => setIsCategoriesModalOpen(true)} className="flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                <SettingsIcon className="w-5 h-5 mr-2" />
                Categorías
            </button>
            <button onClick={handleOpenAddModal} className="flex items-center justify-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
              <PlusIcon className="w-5 h-5 mr-2" />
              Agregar Producto
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

      {isLoading ? (
        <p>Cargando productos...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <ShoppingBagIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No hay productos en el menú</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Comienza agregando tu primer producto.</p>
        </div>
      ) : (
        <>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Buscar producto..."
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
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
            </div>

            {filteredProducts.length === 0 ? (
                 <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <ShoppingBagIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No se encontraron productos</h3>
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
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Precio</th>
                              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {paginatedProducts.map((product) => {
                                const category = categories.find(c => c.name === product.category);
                                const bgColor = category?.color || '#E5E7EB';
                                const textColor = getContrastColor(bgColor);
                                return (
                                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td data-label="Nombre" className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{product.description}</div>
                                  </td>
                                  <td data-label="Categoría" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <span style={{ backgroundColor: bgColor, color: textColor }} className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                        {product.category}
                                    </span>
                                  </td>
                                  <td data-label="Precio" className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-200">${Number(product.price).toLocaleString('es-AR')}</td>
                                  <td data-label="Acciones" className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                    <div className="flex items-center justify-center space-x-4">
                                      <button onClick={() => handleOpenPromoteModal(product)} className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" aria-label={`Promocionar ${product.name}`}>
                                        <MegaphoneIcon className="w-5 h-5" />
                                      </button>
                                      <button onClick={() => handleOpenEditModal(product)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300" aria-label={`Editar ${product.name}`}>
                                        <EditIcon className="w-5 h-5" />
                                      </button>
                                      <button onClick={() => handleOpenDeleteModal(product)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Eliminar ${product.name}`}>
                                        <TrashIcon className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                )
                            })}
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

      <AddProductModal
        isOpen={isAddEditModalOpen}
        onClose={handleCloseModals}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseModals}
        onConfirm={handleConfirmDelete}
        productName={productToDelete?.name || ''}
      />
      
      <ManageCategoriesModal 
        isOpen={isCategoriesModalOpen}
        onClose={() => {
            setIsCategoriesModalOpen(false);
            fetchProductsAndCategories(); // Refetch in case categories changed
        }}
      />
      
      <AdjustPricesModal
        isOpen={isAdjustPricesModalOpen}
        onClose={handleCloseModals}
        onConfirm={handleConfirmAdjustPrices}
        categories={categories}
        products={products}
      />
      
       <PromoteProductModal
        isOpen={isPromoteModalOpen}
        onClose={handleCloseModals}
        product={productToPromote}
      />
      
      <ManagePromotionsModal
        isOpen={isPromotionsModalOpen}
        onClose={() => {
            setIsPromotionsModalOpen(false);
            // Could add a menu refresh here later if needed
        }}
      />

    </div>
  );
};

export default ProductsPanel;
