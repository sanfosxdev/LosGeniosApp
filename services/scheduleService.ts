import type { Schedule, DaySchedule, TimeSlot } from '../types';
import { getScheduleExceptionsFromCache } from './scheduleExceptionService';
import { ExceptionType } from '../types';
import apiService from './apiService';

const SCHEDULE_STORAGE_KEY = 'pizzeria-schedule';

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
        const scheduleArray: any[] = await apiService.get('Schedule');
        
        if (!Array.isArray(scheduleArray) || scheduleArray.length < 7) {
            console.warn('Schedule from sheet is incomplete or invalid, using local cache.');
            return getScheduleFromCache();
        }

        const newSchedule = scheduleArray.reduce((acc, dayData) => {
            if (dayData && dayData.day && typeof dayData.isOpen === 'boolean') {
                let slots: TimeSlot[] = [];
                if (typeof dayData.slots === 'string') {
                    try {
                        const parsedSlots = JSON.parse(dayData.slots);
                        if (Array.isArray(parsedSlots)) {
                           slots = parsedSlots;
                        }
                    } catch (e) {
                        console.error(`Failed to parse slots for day ${dayData.day}:`, dayData.slots);
                    }
                } else if (Array.isArray(dayData.slots)) {
                    slots = dayData.slots;
                }
                
                acc[dayData.day] = {
                    isOpen: dayData.isOpen,
                    slots: slots.length > 0 ? slots : [{ open: '18:00', close: '23:00' }],
                };
            }
            return acc;
        }, {} as Schedule);

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const isComplete = days.every(day => newSchedule.hasOwnProperty(day));
        
        if (!isComplete) {
            console.warn('Fetched schedule is missing days, falling back to cache.');
            return getScheduleFromCache();
        }

        updateCaches(newSchedule);
        return newSchedule;

    } catch (error) {
        console.warn('Failed to fetch schedule from sheet, using local cache.', error);
        return getScheduleFromCache();
    }
};

export const saveSchedule = async (schedule: Schedule): Promise<void> => {
  try {
    // Optimistic update: save locally first
    updateCaches(schedule);
    // Then, save to the sheet
    await apiService.post('saveSchedule', schedule);
  } catch (error) {
    console.error("Failed to save schedule to Google Sheet. It is saved locally.", error);
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