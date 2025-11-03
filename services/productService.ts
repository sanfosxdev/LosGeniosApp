import type { Product, MenuItem } from '../types';
import apiService from './apiService';

const PRODUCTS_STORAGE_KEY = 'pizzeria-products';
const SHEET_NAME = 'Products';

// In-memory cache for synchronous access
let productsCache: Product[] | null = null;

// Helper to update both caches
const updateCaches = (products: Product[]) => {
    productsCache = products;
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
};

const initialMenu: { [category: string]: MenuItem[] } = {
    "Pizzas": [
        { "name": "Muzzarella", "price": "9200", "description": "Muzzarella, salsa, oregano, y aceitunas verdes" },
        { "name": "Tomate Natural", "price": "9700", "description": "Muzzarella, salsa, Tomate natural en rodajas, orégano y aceitunas verdes" },
        { "name": "Napolitana", "price": "9700", "description": "Muzzarella, salsa, ajies, orégano y aceitunas verdes" },
        { "name": "Ajies", "price": "9700", "description": "Muzzarella, salsa, Tomate natural en rodajas, orégano y aceitunas verdes" },
        { "name": "Jamon", "price": "9700", "description": "Muzzarella, salsa, jamón, orégano y aceitunas verdes" },
        { "name": "Morron", "price": "9700", "description": "Muzzarella, salsa, morron, orégano y aceitunas verdes" },
        { "name": "Americana", "price": "9700", "description": "Muzzarella, salsa, cebolla fina, orégano y aceitunas verdes" },
        { "name": "Calabresa", "price": "9900", "description": "Muzzarella, salsa, longaniza, orégano y aceitunas verdes" },
        { "name": "Provolone", "price": "9900", "description": "Muzzarella, salsa, provolone, orégano y aceitunas verdes" },
        { "name": "Roquefort", "price": "9700", "description": "Muzzarella, salsa, roquefort, orégano y aceitunas verdes" },
        { "name": "3 Quesos", "price": "9700", "description": "Muzzarella, salsa, provolone, roquefort, orégano y aceitunas verdes" }
    ],
    "Empanadas": [
        { "name": "Empanadas de Carne", "price": "600" },
        { "name": "Empanadas Queso", "price": "500" },
        { "name": "Empanadas JyQ", "price": "600" },
        { "name": "Empanadas Humita", "price": "600" },
        { "name": "FRISNACKS GRANDE", "price": "4500" },
    ],
    "Hamburguesas": [
        { "name": "Burger Común", "price": "3000" },
        { "name": "Burger Especial", "price": "4000" },
        { "name": "Super Burger", "price": "6000" },
        { "name": "Burger Doble Carne Clasica", "price": "5000" }
    ],
    "Lomitos": [
        { "name": "Lomito Común pan Baguet", "price": "4000" },
        { "name": "Lomito Especial pan Baguet", "price": "6000" }
    ],
    "Sandwichs": [
        { "name": "Carlito Común", "price": "2000" },
        { "name": "Carilito Especial", "price": "3500" }
    ]
};

const initializeProducts = () => {
    try {
        const productsJson = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (productsJson) {
            productsCache = JSON.parse(productsJson);
            return;
        }

        const productList: Product[] = [];
        Object.entries(initialMenu).forEach(([category, items]) => {
            items.forEach(item => {
                productList.push({
                    id: `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    category,
                    name: item.name,
                    description: item.description || '',
                    price: item.price,
                });
            });
        });
        updateCaches(productList);
    } catch (error) {
        console.error("Failed to initialize products in localStorage", error);
    }
};

initializeProducts();

export const getProductsFromCache = (): Product[] => {
    return productsCache || [];
};

export const fetchAndCacheProducts = async (): Promise<Product[]> => {
    try {
        const productsFromSheet = await apiService.get(SHEET_NAME);
        updateCaches(productsFromSheet);
        return productsFromSheet;
    } catch (error) {
        console.warn('Failed to fetch products from sheet, using local cache.', error);
        return getProductsFromCache();
    }
};

export const addProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
    const newProduct: Product = {
        ...productData,
        id: `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    const currentCache = getProductsFromCache();
    updateCaches([...currentCache, newProduct]);

    try {
        await apiService.post('addData', { sheetName: SHEET_NAME, item: newProduct });
        return newProduct;
    } catch (error) {
        console.error('Failed to add product to sheet. It is saved locally.', error);
        throw new Error('No se pudo guardar el producto en la base de datos. Se guardó localmente.');
    }
};

export const updateProduct = async (updatedProduct: Product): Promise<Product> => {
    const currentCache = getProductsFromCache();
    const productIndex = currentCache.findIndex(p => p.id === updatedProduct.id);

    if (productIndex !== -1) {
        const newCache = [...currentCache];
        newCache[productIndex] = updatedProduct;
        updateCaches(newCache);
    }

    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedProduct });
        return updatedProduct;
    } catch (error) {
        console.error('Failed to update product in sheet.', error);
        throw new Error('No se pudo actualizar el producto. Los cambios se guardaron localmente.');
    }
};

export const deleteProduct = async (productId: string): Promise<void> => {
    const newCache = getProductsFromCache().filter(p => p.id !== productId);
    updateCaches(newCache);

    try {
        await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: productId });
    } catch (error) {
        console.error('Failed to delete product from sheet.', error);
        throw new Error('No se pudo eliminar el producto de la base de datos. Se eliminó localmente.');
    }
};

export const adjustProductPrices = async (
  targetCategory: string,
  percentage: number,
  rounding: 'none' | 'integer' | '10' | '50' | '100'
): Promise<void> => {
  const products = getProductsFromCache();
  const adjustmentFactor = 1 + percentage / 100;

  const roundPrice = (price: number): number => {
    if (isNaN(price)) return 0;
    switch (rounding) {
      case 'integer': return Math.round(price);
      case '10': return Math.round(price / 10) * 10;
      case '50': return Math.round(price / 50) * 50;
      case '100': return Math.round(price / 100) * 100;
      case 'none': default: return parseFloat(price.toFixed(2));
    }
  };

  const updatedProducts = products.map(product => {
    if (targetCategory === 'all' || product.category === targetCategory) {
      const currentPrice = parseFloat(product.price);
      if (!isNaN(currentPrice)) {
        const newPrice = currentPrice * adjustmentFactor;
        return { ...product, price: roundPrice(newPrice).toString() };
      }
    }
    return product;
  });
  
  updateCaches(updatedProducts);

  try {
    const headers = ['id', 'category', 'name', 'description', 'price', 'imageUrl'];
    await apiService.post('syncDataType', { sheetName: SHEET_NAME, items: updatedProducts, headers });
  } catch (error) {
    console.error('Failed to sync adjusted prices.', error);
    throw new Error('No se pudo sincronizar el ajuste de precios. Los cambios se guardaron localmente.');
  }
};

export const importProducts = (
  productsToImport: Omit<Product, 'id' | 'imageUrl'>[]
): { added: number; updated: number; errors: number } => {
  const existingProducts = getProductsFromCache();
  let added = 0;
  let updated = 0;
  let errors = 0;

  productsToImport.forEach(newProd => {
    if (!newProd.name || !newProd.category || !newProd.price) {
      errors++;
      return;
    }
    const existingProductIndex = existingProducts.findIndex(p => p.name.trim().toLowerCase() === newProd.name.trim().toLowerCase() && p.category === newProd.category);
    if (existingProductIndex > -1) {
      existingProducts[existingProductIndex] = { ...existingProducts[existingProductIndex], ...newProd };
      updated++;
    } else {
      const newProduct: Product = { ...newProd, id: `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
      existingProducts.push(newProduct);
      added++;
    }
  });

  updateCaches(existingProducts);
  // Defer the sync to avoid blocking UI. The user can sync manually if needed.
  const headers = ['id', 'category', 'name', 'description', 'price', 'imageUrl'];
  apiService.post('syncDataType', { sheetName: SHEET_NAME, items: existingProducts, headers }).catch(e => console.error("Error syncing imported products:", e));
  
  return { added, updated, errors };
};
