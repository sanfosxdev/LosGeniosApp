import type { CustomerCategory } from '../types';
import { reassignCustomersFromCategory } from './customerService';
import apiService from './apiService';

const CUSTOMER_CATEGORIES_STORAGE_KEY = 'pizzeria-customer-categories';
const SHEET_NAME = 'CustomerCategories';

let categoriesCache: CustomerCategory[] | null = null;

const updateCaches = (categories: CustomerCategory[]) => {
    categoriesCache = categories.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem(CUSTOMER_CATEGORIES_STORAGE_KEY, JSON.stringify(categoriesCache));
};

const initialCategories: Omit<CustomerCategory, 'id'>[] = [
    { name: 'Nuevo', color: '#4CAF50' },
    { name: 'Regular', color: '#2196F3' },
    { name: 'VIP', color: '#FFC107' },
];

const initializeCustomerCategories = () => {
    try {
        const categoriesJson = localStorage.getItem(CUSTOMER_CATEGORIES_STORAGE_KEY);
        if (categoriesJson) {
            const categories = JSON.parse(categoriesJson) as CustomerCategory[];
            let needsUpdate = false;
            
            if (!categories.some(c => c.name === 'Nuevo')) {
                categories.push({ name: 'Nuevo', color: '#4CAF50', id: `CUSTCAT-default-new` });
                needsUpdate = true;
            }
            categories.forEach(cat => {
                if (!cat.color) {
                    cat.color = initialCategories.find(d => d.name === cat.name)?.color || '#CCCCCC';
                    needsUpdate = true;
                }
            });
            updateCaches(categories);
            if(needsUpdate) localStorage.setItem(CUSTOMER_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
            return;
        }

        const initialCategoriesWithIds: CustomerCategory[] = initialCategories.map(cat => ({
            ...cat,
            id: `CUSTCAT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        }));
        
        updateCaches(initialCategoriesWithIds);
    } catch (error) {
        console.error("Failed to initialize customer categories in localStorage", error);
    }
};

initializeCustomerCategories();

export const getCustomerCategoriesFromCache = (): CustomerCategory[] => {
    return categoriesCache || [];
};

export const fetchAndCacheCustomerCategories = async (): Promise<CustomerCategory[]> => {
    try {
        const categories = await apiService.get(SHEET_NAME);
        updateCaches(categories);
        return categories;
    } catch(e) {
        console.warn("Could not fetch customer categories, using local cache", e);
        return getCustomerCategoriesFromCache();
    }
}

export const addCustomerCategory = async (categoryData: Omit<CustomerCategory, 'id'>): Promise<CustomerCategory> => {
    const newCategory: CustomerCategory = {
        ...categoryData,
        id: `CUSTCAT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    updateCaches([...getCustomerCategoriesFromCache(), newCategory]);
    
    try {
        await apiService.post('addData', { sheetName: SHEET_NAME, item: newCategory });
        return newCategory;
    } catch(e) {
        throw new Error(`Failed to save customer category: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const updateCustomerCategory = async (updatedCategory: CustomerCategory): Promise<CustomerCategory> => {
    const currentCache = getCustomerCategoriesFromCache();
    const categoryIndex = currentCache.findIndex(c => c.id === updatedCategory.id);
    if (categoryIndex !== -1) {
        const newCache = [...currentCache];
        newCache[categoryIndex] = updatedCategory;
        updateCaches(newCache);
    }

    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedCategory });
        return updatedCategory;
    } catch(e) {
        throw new Error(`Failed to update customer category: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const deleteCustomerCategory = async (categoryId: string): Promise<void> => {
    const categoryToDelete = getCustomerCategoriesFromCache().find(c => c.id === categoryId);
    if (categoryToDelete?.name === 'Nuevo') {
        throw new Error('La categoría "Nuevo" no se puede eliminar.');
    }
    
    await reassignCustomersFromCategory(categoryId);
    const newCache = getCustomerCategoriesFromCache().filter(c => c.id !== categoryId);
    updateCaches(newCache);
    
    try {
        await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: categoryId });
    } catch(e) {
        throw new Error(`Failed to delete customer category: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const getDefaultNewCustomerCategory = (): CustomerCategory | undefined => {
    return getCustomerCategoriesFromCache().find(c => c.name === 'Nuevo');
}
