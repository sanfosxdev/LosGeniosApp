import type { User, UserRole } from '../types';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const USERS_STORAGE_KEY = 'pizzeria-users';
const SHEET_NAME = 'Users';

let usersCache: User[] | null = null;

export const updateCaches = (users: User[]) => {
    usersCache = users.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersCache));
};

const initializeUsers = () => {
    try {
        const localData = localStorage.getItem(USERS_STORAGE_KEY);
        if (localData) {
            usersCache = JSON.parse(localData);
        } else {
            usersCache = [];
        }
    } catch(e) {
        console.error("Failed to initialize users cache:", e);
        usersCache = [];
    }
};

initializeUsers();

export const getUsersFromCache = (): User[] => {
    return usersCache || [];
};

export const fetchAndCacheUsers = async (): Promise<User[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getUsersFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getUsersFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const users = querySnapshot.docs.map(doc => doc.data() as User);
        updateCaches(users);
        return users;
    } catch (error) {
        console.warn('Failed to fetch users, using local cache.', error);
        return getUsersFromCache();
    }
};

export const addUser = async (userData: Omit<User, 'id' | 'createdAt' | 'lastAccess'>): Promise<User> => {
  const existingUsers = getUsersFromCache();
  const email = userData.email.trim().toLowerCase();

  const duplicateUser = existingUsers.find(u => u.email.toLowerCase() === email);
  if (duplicateUser) {
    throw new Error(`Ya existe un usuario con el email ${email}.`);
  }

  const newUser: User = {
    ...userData,
    email,
    id: `USER-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    lastAccess: null,
  };

  try {
      await setDoc(doc(db, SHEET_NAME, newUser.id), newUser);
      // No optimistic update here, let Firebase listener handle it
      return newUser;
  } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error al guardar usuario en la nube: ${message}`);
  }
};

export const updateUser = async (updatedUser: Omit<User, 'createdAt' | 'lastAccess'> & { id: string }): Promise<User> => {
  const users = getUsersFromCache();
  const email = updatedUser.email.trim().toLowerCase();
  
  const duplicateUser = users.find(u => u.id !== updatedUser.id && u.email.toLowerCase() === email);
  if (duplicateUser) {
    throw new Error(`Ya existe otro usuario con el email ${email}.`);
  }

  const userIndex = users.findIndex(u => u.id === updatedUser.id);
  if (userIndex === -1) throw new Error("Usuario no encontrado para actualizar.");
  
  const finalUser = { ...users[userIndex], ...updatedUser, email };

  try {
    await setDoc(doc(db, SHEET_NAME, finalUser.id), finalUser, { merge: true });
     // No optimistic update here, let Firebase listener handle it
    return finalUser;
  } catch (e) {
     const message = e instanceof Error ? e.message : String(e);
     throw new Error(`Error al actualizar usuario en la nube: ${message}`);
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
      await deleteDoc(doc(db, SHEET_NAME, userId));
       // No optimistic update here, let Firebase listener handle it
  } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Error al eliminar usuario en la nube: ${message}`);
  }
};