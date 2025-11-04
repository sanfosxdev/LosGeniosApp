import type { Schedule, DaySchedule, TimeSlot } from '../types';
import { getScheduleExceptionsFromCache } from './scheduleExceptionService';
import { ExceptionType } from '../types';
import { db, collection, getDoc, doc, setDoc } from './firebase';

const SCHEDULE_STORAGE_KEY = 'pizzeria-schedule';
const SCHEDULE_COLLECTION_NAME = 'Schedule';
const SCHEDULE_DOC_ID = 'main';

let scheduleCache: Schedule | null = null;

const updateCaches = (schedule: Schedule) => {
    scheduleCache = schedule;
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
}

const initialSchedule: Schedule = {
  monday:    { isOpen: true, slots: [{ open: '18:00', close: '23:00' }] },
  tuesday:   { isOpen: false, slots: [{ open: '18:00', close: '23:00' }] },
  wednesday: { isOpen: true, slots: [{ open: '18:00', close: '23:00' }] },
  thursday:  { isOpen: true, slots: [{ open: '18:00', close: '23:00' }] },
  friday:    { isOpen: true, slots: [{ open: '18:00', close: '23:59' }] },
  saturday:  { isOpen: true, slots: [{ open: '11:00', close: '23:59' }] },
  sunday:    { isOpen: true, slots: [{ open: '11:00', close: '23:00' }] },
};

const migrateSchedule = (oldSchedule: any): Schedule => {
    const newSchedule: Schedule = {} as Schedule;
    for (const day in initialSchedule) {
        if (Object.prototype.hasOwnProperty.call(oldSchedule, day)) {
            const oldDay = oldSchedule[day];
            if (oldDay.hasOwnProperty('open') && oldDay.hasOwnProperty('close')) {
                newSchedule[day] = { isOpen: oldDay.isOpen, slots: [{ open: oldDay.open, close: oldDay.close }] };
            } else {
                newSchedule[day] = oldDay;
            }
        } else {
             newSchedule[day] = initialSchedule[day];
        }
    }
    return newSchedule;
};


const initializeSchedule = () => {
  try {
    const scheduleJson = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!scheduleJson) {
      updateCaches(initialSchedule);
    } else {
        const parsed = JSON.parse(scheduleJson);
        const firstDayKey = Object.keys(parsed)[0];
        if (firstDayKey && parsed[firstDayKey].hasOwnProperty('open')) {
            const migrated = migrateSchedule(parsed);
            updateCaches(migrated);
        } else {
            updateCaches(parsed);
        }
    }
  } catch (error) {
    console.error("Failed to initialize or migrate schedule in localStorage", error);
  }
};

initializeSchedule();

export const getScheduleFromCache = (): Schedule => {
  return scheduleCache || initialSchedule;
};

export const fetchAndCacheSchedule = async (): Promise<Schedule> => {
    try {
        const docRef = doc(db, SCHEDULE_COLLECTION_NAME, SCHEDULE_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const scheduleFromDb = docSnap.data() as Schedule;
            updateCaches(scheduleFromDb);
            return scheduleFromDb;
        } else {
            // If it doesn't exist in Firebase, use local/initial and save it.
            const localSchedule = getScheduleFromCache();
            await setDoc(docRef, localSchedule);
            return localSchedule;
        }
    } catch (error) {
        console.warn('Failed to fetch schedule from Firebase, using local cache.', error);
        return getScheduleFromCache();
    }
};

export const saveSchedule = async (schedule: Schedule): Promise<void> => {
  try {
    // Optimistic update: save locally first
    updateCaches(schedule);
    // Then, save to Firebase
    await setDoc(doc(db, SCHEDULE_COLLECTION_NAME, SCHEDULE_DOC_ID), schedule);
  } catch (error) {
    console.error("Failed to save schedule to Firebase. It is saved locally.", error);
    // Re-throw the error to be caught by the UI
    throw new Error('No se pudo guardar el horario en la base de datos. Se guardó localmente.');
  }
};


const checkTimeInSlot = (now: Date, slot: TimeSlot, checkDate: Date): boolean => {
    const [openHour, openMinute] = slot.open.split(':').map(Number);
    const [closeHour, closeMinute] = slot.close.split(':').map(Number);

    const openTime = new Date(checkDate);
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date(checkDate);
    closeTime.setHours(closeHour, closeMinute, 0, 0);
    
    if (closeTime.getTime() <= openTime.getTime()) {
        closeTime.setDate(closeTime.getDate() + 1);
    }

    return now.getTime() >= openTime.getTime() && now.getTime() <= closeTime.getTime();
};

export const isBusinessOpen = (): boolean => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const exceptions = getScheduleExceptionsFromCache();
    const todayException = exceptions.find(ex => todayStr >= ex.startDate && todayStr <= ex.endDate);

    if (todayException) {
        if (todayException.type === ExceptionType.CLOSED) return false;
        if (todayException.type === ExceptionType.SPECIAL_HOURS && todayException.slots) {
            for (const slot of todayException.slots) {
                if (checkTimeInSlot(now, slot, now)) return true;
            }
             const yesterday = new Date(now);
             yesterday.setDate(now.getDate() - 1);
             for (const slot of todayException.slots) {
                if (checkTimeInSlot(now, slot, yesterday)) return true;
            }
            return false;
        }
    }

    const schedule = getScheduleFromCache();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    const todayName = dayNames[now.getDay()];
    const todaySchedule = schedule[todayName];
    if (todaySchedule && todaySchedule.isOpen) {
        for (const slot of todaySchedule.slots) {
            if (checkTimeInSlot(now, slot, now)) return true;
        }
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayName = dayNames[yesterday.getDay()];
    const yesterdaySchedule = schedule[yesterdayName];
    if (yesterdaySchedule && yesterdaySchedule.isOpen) {
        for (const slot of yesterdaySchedule.slots) {
            if (checkTimeInSlot(now, slot, yesterday)) return true;
        }
    }

    return false;
};
