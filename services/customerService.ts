import type { Customer } from '../types';
import { getCustomerCategoriesFromCache, getDefaultNewCustomerCategory } from './customerCategoryService';
import apiService from './apiService';

const CUSTOMERS_STORAGE_KEY = 'pizzeria-customers';
const SHEET_NAME = 'Customers';

let customersCache: Customer[] | null = null;

const updateCaches = (customers: Customer[]) => {
    customersCache = customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customersCache));
};

const initializeCustomers = () => {
    try {
        const localData = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
        if (localData) {
            customersCache = JSON.parse(localData);
        } else {
            customersCache = [];
        }
    } catch(e) {
        console.error(e);
        customersCache = [];
    }
};

initializeCustomers();


export const getCustomersFromCache = (): Customer[] => {
    return customersCache || [];
};

export const fetchAndCacheCustomers = async (): Promise<Customer[]> => {
    try {
        const customers = await apiService.get(SHEET_NAME);
        // Data migration for customers without a category
        const categories = getCustomerCategoriesFromCache();
        const defaultCategory = getDefaultNewCustomerCategory();
        const defaultCategoryId = defaultCategory ? defaultCategory.id : 'default-nuevo';
        const categoryIds = new Set(categories.map(c => c.id));
        
        customers.forEach((customer: any) => {
            if (!customer.categoryId || !categoryIds.has(customer.categoryId)) {
                customer.categoryId = defaultCategoryId;
            }
        });
        
        updateCaches(customers);
        return customers;
    } catch (error) {
        console.warn('Failed to fetch customers, using local cache.', error);
        return getCustomersFromCache();
    }
};

export const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> => {
  const existingCustomers = getCustomersFromCache();
  const phone = (customerData.phone || '').trim();
  const email = (customerData.email || '').trim().toLowerCase();

  const duplicateCustomer = existingCustomers.find(c => (c.phone && c.phone === phone) || (c.email && c.email.toLowerCase() === email));
  if (duplicateCustomer) {
    throw new Error(`Ya existe un cliente con ese teléfono o email.`);
  }

  const defaultCategory = getDefaultNewCustomerCategory();
  const newCustomer: Customer = {
    ...customerData,
    phone,
    email,
    id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    categoryId: customerData.categoryId || (defaultCategory ? defaultCategory.id : 'default-nuevo'),
  };

  updateCaches([newCustomer, ...existingCustomers]);

  try {
      await apiService.post('addData', { sheetName: SHEET_NAME, item: newCustomer });
      return newCustomer;
  } catch (e) {
      throw new Error(`Error al guardar cliente en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateCustomer = async (updatedCustomer: Customer): Promise<Customer> => {
  const customers = getCustomersFromCache();
  const phone = (updatedCustomer.phone || '').trim();
  const email = (updatedCustomer.email || '').trim().toLowerCase();
  
  const duplicateCustomer = customers.find(c => c.id !== updatedCustomer.id && ((c.phone && c.phone === phone) || (c.email && c.email.toLowerCase() === email)));
  if (duplicateCustomer) {
    throw new Error(`Ya existe otro cliente con ese teléfono o email.`);
  }

  const customerIndex = customers.findIndex(c => c.id === updatedCustomer.id);
  if (customerIndex === -1) throw new Error("Customer not found");
  
  const newCache = [...customers];
  newCache[customerIndex] = { ...updatedCustomer, phone, email };
  updateCaches(newCache);

  try {
    await apiService.post('updateData', { sheetName: SHEET_NAME, item: newCache[customerIndex] });
    return newCache[customerIndex];
  } catch (e) {
     throw new Error(`Error al actualizar cliente en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deleteCustomer = async (customerId: string): Promise<void> => {
  const newCache = getCustomersFromCache().filter(c => c.id !== customerId);
  updateCaches(newCache);
  
  try {
      await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: customerId });
  } catch (e) {
      throw new Error(`Error al eliminar cliente en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const reassignCustomersFromCategory = async (deletedCategoryId: string) => {
    const customers = getCustomersFromCache();
    const defaultCategory = getDefaultNewCustomerCategory();
    if (!defaultCategory) return;

    let updated = false;
    const updatedCustomers = customers.map(c => {
        if(c.categoryId === deletedCategoryId) {
            updated = true;
            return {...c, categoryId: defaultCategory.id};
        }
        return c;
    });

    if (updated) {
        updateCaches(updatedCustomers);
        try {
            const headers = ['id', 'name', 'phone', 'email', 'address', 'createdAt', 'categoryId'];
            await apiService.post('syncDataType', { sheetName: SHEET_NAME, items: updatedCustomers, headers });
        } catch(e) {
            console.error("Failed to sync customer reassignments", e);
            // The change is already local, so it will be fixed on next full sync.
        }
    }
};

export const importCustomers = (
  customersToImport: any[]
): { added: number; updated: number; errors: number } => {
  const existingCustomers = getCustomersFromCache();
  const categories = getCustomerCategoriesFromCache();
  const defaultCategory = getDefaultNewCustomerCategory();
  let added = 0;
  let updated = 0;
  let errors = 0;

  const categoryMap = new Map<string, string>();
  categories.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

  customersToImport.forEach(newCust => {
    if (!newCust.name || !newCust.name.trim() || !newCust.phone || !newCust.email) {
      errors++; return;
    }
    const categoryId = categoryMap.get(newCust.categoryName?.trim().toLowerCase() || '') || defaultCategory?.id;
    if (!categoryId) { errors++; return; }
    
    const phone = newCust.phone?.trim() || '';
    const email = newCust.email?.trim().toLowerCase() || '';

    if (!/^\d{10,}$/.test(phone.replace(/\D/g, ''))) { errors++; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors++; return; }

    const customerData = { name: newCust.name.trim(), phone, email, address: newCust.address?.trim() || '', categoryId };
    const existingCustomerIndex = existingCustomers.findIndex(c => c.phone === phone || c.email === email);
    
    if (existingCustomerIndex > -1) {
      existingCustomers[existingCustomerIndex] = { ...existingCustomers[existingCustomerIndex], ...customerData };
      updated++;
    } else {
      const newCustomer: Customer = { ...customerData, id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, createdAt: new Date().toISOString() };
      existingCustomers.push(newCustomer);
      added++;
    }
  });
  
  updateCaches(existingCustomers);
  const headers = ['id', 'name', 'phone', 'email', 'address', 'createdAt', 'categoryId'];
  apiService.post('syncDataType', { sheetName: SHEET_NAME, items: existingCustomers, headers }).catch(e => console.error("Error syncing imported customers:", e));
  
  return { added, updated, errors };
};
