import type { ScheduleException } from '../types';
import apiService from './apiService';

const EXCEPTIONS_STORAGE_KEY = 'pizzeria-schedule-exceptions';
const SHEET_NAME = 'ScheduleExceptions';

let exceptionsCache: ScheduleException[] | null = null;

const updateCaches = (exceptions: ScheduleException[]) => {
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
        const exceptions = await apiService.get(SHEET_NAME);
        updateCaches(exceptions);
        return exceptions;
    } catch (e) {
        console.warn("Could not fetch schedule exceptions, using local cache.", e);
        return getScheduleExceptionsFromCache();
    }
};

export const addScheduleException = async (exceptionData: Omit<ScheduleException, 'id'>): Promise<ScheduleException> => {
  const newException: ScheduleException = {
    ...exceptionData,
    id: `EXC-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };

  updateCaches([...getScheduleExceptionsFromCache(), newException]);

  try {
      await apiService.post('addData', { sheetName: SHEET_NAME, item: newException });
      return newException;
  } catch (e) {
      throw new Error(`Failed to save exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateScheduleException = async (updatedException: ScheduleException): Promise<ScheduleException> => {
  const exceptions = getScheduleExceptionsFromCache();
  const exceptionIndex = exceptions.findIndex(e => e.id === updatedException.id);
  if (exceptionIndex === -1) throw new Error("Exception not found");

  const newCache = [...exceptions];
  newCache[exceptionIndex] = updatedException;
  updateCaches(newCache);
  
  try {
    await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedException });
    return updatedException;
  } catch (e) {
    throw new Error(`Failed to update exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deleteScheduleException = async (exceptionId: string): Promise<void> => {
  updateCaches(getScheduleExceptionsFromCache().filter(e => e.id !== exceptionId));
  
  try {
    await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: exceptionId });
  } catch (e) {
    throw new Error(`Failed to delete exception: ${e instanceof Error ? e.message : String(e)}`);
  }
};
