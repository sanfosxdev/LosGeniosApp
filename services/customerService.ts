import type { Customer } from '../types';
import { getCustomerCategoriesFromCache, getDefaultNewCustomerCategory } from './customerCategoryService';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where } from './firebase';

const CUSTOMERS_STORAGE_KEY = 'pizzeria-customers';
const SHEET_NAME = 'Customers';

let customersCache: Customer[] | null = null;

export const updateCaches = (customers: Customer[]) => {
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
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getCustomersFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getCustomersFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const customers = querySnapshot.docs.map(doc => doc.data() as Customer);
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

  try {
      await setDoc(doc(db, SHEET_NAME, newCustomer.id), newCustomer);
      updateCaches([newCustomer, ...existingCustomers]);
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
  
  try {
    await setDoc(doc(db, SHEET_NAME, updatedCustomer.id), { ...updatedCustomer, phone, email });
    const newCache = [...customers];
    newCache[customerIndex] = { ...updatedCustomer, phone, email };
    updateCaches(newCache);
    return newCache[customerIndex];
  } catch (e) {
     throw new Error(`Error al actualizar cliente en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deleteCustomer = async (customerId: string): Promise<void> => {
  try {
      await deleteDoc(doc(db, SHEET_NAME, customerId));
      const newCache = getCustomersFromCache().filter(c => c.id !== customerId);
      updateCaches(newCache);
  } catch (e) {
      throw new Error(`Error al eliminar cliente en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const reassignCustomersFromCategory = async (deletedCategoryId: string) => {
    const defaultCategory = getDefaultNewCustomerCategory();
    if (!defaultCategory) return;

    try {
        const q = query(collection(db, SHEET_NAME), where("categoryId", "==", deletedCategoryId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return;

        const batch = writeBatch(db);
        querySnapshot.forEach(customerDoc => {
            const docRef = doc(db, SHEET_NAME, customerDoc.id);
            batch.update(docRef, { categoryId: defaultCategory.id });
        });
        await batch.commit();

        // Also update local cache for immediate UI feedback
        const customers = getCustomersFromCache();
        const updatedCustomers = customers.map(c => {
            if (c.categoryId === deletedCategoryId) {
                return {...c, categoryId: defaultCategory.id};
            }
            return c;
        });
        updateCaches(updatedCustomers);

    } catch(e) {
        console.error("Failed to reassign customers in Firebase", e);
        throw new Error(`Failed to reassign customers: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const importCustomers = async (customersToImport: any[]): Promise<{ added: number; updated: number; errors: number }> => {
  let added = 0;
  let updated = 0;
  let errors = 0;

  const categories = getCustomerCategoriesFromCache();
  const defaultCategory = getDefaultNewCustomerCategory();
  const categoryMap = new Map<string, string>();
  categories.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

  const batch = writeBatch(db);
  const localCustomers = getCustomersFromCache();

  for (const newCust of customersToImport) {
    if (!newCust.name || !newCust.name.trim() || !newCust.phone || !newCust.email) {
      errors++; continue;
    }
    const categoryId = categoryMap.get(newCust.categoryName?.trim().toLowerCase() || '') || defaultCategory?.id;
    if (!categoryId) { errors++; continue; }
    
    const phone = newCust.phone?.trim() || '';
    const email = newCust.email?.trim().toLowerCase() || '';

    if (!/^\d{10,}$/.test(phone.replace(/\D/g, ''))) { errors++; continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors++; continue; }

    const customerData = { name: newCust.name.trim(), phone, email, address: newCust.address?.trim() || '', categoryId };
    const existingCustomer = localCustomers.find(c => c.phone === phone || c.email === email);
    
    if (existingCustomer) {
      const docRef = doc(db, SHEET_NAME, existingCustomer.id);
      batch.set(docRef, { ...existingCustomer, ...customerData });
      updated++;
    } else {
      const newId = `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newCustomer: Customer = { ...customerData, id: newId, createdAt: new Date().toISOString() };
      const docRef = doc(db, SHEET_NAME, newId);
      batch.set(docRef, newCustomer);
      added++;
    }
  }
  
  await batch.commit();
  await fetchAndCacheCustomers(); // Refresh local cache from source of truth
  
  return { added, updated, errors };
};