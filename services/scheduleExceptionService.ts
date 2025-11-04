import type { ScheduleException } from '../types';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const EXCEPTIONS_STORAGE_KEY = 'pizzeria-schedule-exceptions';
const SHEET_NAME = 'ScheduleExceptions';

let exceptionsCache: ScheduleException[] | null = null;

export const updateCaches = (exceptions: ScheduleException[]) => {
    exceptionsCache = exceptions;
    localStorage.setItem(EXCEPTIONS_STORAGE_KEY, JSON.stringify(exceptions));
};

const initializeExceptions = () => {
  try {
    const exceptionsJson = localStorage.getItem(EXCEPTIONS_STORAGE_KEY);
    if (!exceptionsJson) {
      updateCaches([]);
    } else {
      updateCaches(JSON.parse(exceptionsJson));
    }
  } catch (error) {
    console.error("Failed to initialize schedule exceptions in localStorage", error);
  }
};

initializeExceptions();

export const getScheduleExceptionsFromCache = (): ScheduleException[] => {
  return exceptionsCache || [];
};

export const fetchAndCacheScheduleExceptions = async (): Promise<ScheduleException[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getScheduleExceptionsFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getScheduleExceptionsFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const exceptions = querySnapshot.docs.map(doc => doc.data() as ScheduleException);
        updateCaches(exceptions);
        return exceptions;
    } catch (e) {
        console.warn("Could not fetch schedule exceptions from Firebase, using local cache.", e);
        return getScheduleExceptionsFromCache();
    }
};

export const addScheduleException = async (exceptionData: Omit<ScheduleException, 'id'>): Promise<ScheduleException> => {
  const newException: ScheduleException = {
    ...exceptionData,
    id: `EXC-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };

  try {
      await setDoc(doc(db, SHEET_NAME, newException.id), newException);
      updateCaches([...getScheduleExceptionsFromCache(), newException]);
      return newException;
  } catch (e) {
      throw new Error(`Failed to save exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateScheduleException = async (updatedException: ScheduleException): Promise<ScheduleException> => {
  try {
    await setDoc(doc(db, SHEET_NAME, updatedException.id), updatedException);
    const exceptions = getScheduleExceptionsFromCache();
    const exceptionIndex = exceptions.findIndex(e => e.id === updatedException.id);
    if (exceptionIndex !== -1) {
        const newCache = [...exceptions];
        newCache[exceptionIndex] = updatedException;
        updateCaches(newCache);
    }
    return updatedException;
  } catch (e) {
    throw new Error(`Failed to update exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deleteScheduleException = async (exceptionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SHEET_NAME, exceptionId));
    updateCaches(getScheduleExceptionsFromCache().filter(e => e.id !== exceptionId));
  } catch (e) {
    throw new Error(`Failed to delete exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};
