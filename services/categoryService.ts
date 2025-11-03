import type { Category } from '../types';
import apiService from './apiService';

const CATEGORIES_STORAGE_KEY = 'pizzeria-categories';
const SHEET_NAME = 'Categories';

let categoriesCache: Category[] | null = null;

const updateCaches = (categories: Category[]) => {
    categoriesCache = categories.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categoriesCache));
};

const initialCategoriesData: Omit<Category, 'id'>[] = [
    { name: 'Pizzas', imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=774&q=80', color: '#E53935' },
    { name: 'Empanadas', imageUrl: 'https://images.unsplash.com/photo-1606901826322-10a4f5a3a4c8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80', color: '#FFA000' },
    { name: 'Hamburguesas', imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1172&q=80', color: '#795548' },
    { name: 'Lomitos', imageUrl: 'https://images.unsplash.com/photo-1639883582845-f6c125d326c4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80', color: '#8D6E63' },
    { name: 'Sandwichs', imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1173&q=80', color: '#FBC02D' }
];

const initializeCategories = () => {
    try {
        const categoriesJson = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (categoriesJson) {
            const categories = JSON.parse(categoriesJson) as Category[];
            // Migration for categories without color
            let needsUpdate = false;
            categories.forEach(cat => {
                if (!cat.color) {
                    const initialData = initialCategoriesData.find(d => d.name === cat.name);
                    cat.color = initialData?.color || '#CCCCCC';
                    needsUpdate = true;
                }
            });
            updateCaches(categories);
            if (needsUpdate) {
                localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
            }
            return;
        }

        const initialCategories: Category[] = initialCategoriesData.map(cat => ({
            ...cat,
            id: `CAT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        }));
        
        updateCaches(initialCategories);
    } catch (error) {
        console.error("Failed to initialize categories in localStorage", error);
    }
};

initializeCategories();

export const getCategoriesFromCache = (): Category[] => {
    return categoriesCache || [];
};

export const fetchAndCacheCategories = async (): Promise<Category[]> => {
    try {
        const categoriesFromSheet = await apiService.get(SHEET_NAME);
        updateCaches(categoriesFromSheet);
        return categoriesFromSheet;
    } catch (error) {
        console.warn('Failed to fetch categories, using local cache.', error);
        return getCategoriesFromCache();
    }
};

export const addCategory = async (categoryData: Omit<Category, 'id'>): Promise<Category> => {
    const newCategory: Category = {
        ...categoryData,
        id: `CAT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    const currentCache = getCategoriesFromCache();
    updateCaches([...currentCache, newCategory]);

    try {
        await apiService.post('addData', { sheetName: SHEET_NAME, item: newCategory });
        return newCategory;
    } catch (error) {
        console.error('Failed to add category to sheet.', error);
        throw new Error('No se pudo guardar la categoría en la base de datos.');
    }
};

export const updateCategory = async (updatedCategory: Category): Promise<Category> => {
    const currentCache = getCategoriesFromCache();
    const categoryIndex = currentCache.findIndex(c => c.id === updatedCategory.id);
    if (categoryIndex !== -1) {
        const newCache = [...currentCache];
        newCache[categoryIndex] = updatedCategory;
        updateCaches(newCache);
    }

    try {
        await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedCategory });
        return updatedCategory;
    } catch (error) {
        console.error('Failed to update category.', error);
        throw new Error('No se pudo actualizar la categoría.');
    }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
    const newCache = getCategoriesFromCache().filter(c => c.id !== categoryId);
    updateCaches(newCache);
    
    try {
        await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: categoryId });
    } catch (error) {
        console.error('Failed to delete category.', error);
        throw new Error('No se pudo eliminar la categoría de la base de datos.');
    }
};
