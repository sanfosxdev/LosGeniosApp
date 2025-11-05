import type { Reservation, Table, ReservationCancellationReason, ReservationSettings, StatusHistory } from '../types';
import { ReservationStatus, CreatedBy, OrderType, ExceptionType } from '../types';
import { getScheduleFromCache } from './scheduleService';
import { getOrdersFromCache, isOrderFinished } from './orderService';
import { getScheduleExceptionsFromCache } from './scheduleExceptionService';
import { addNotification } from './notificationService';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getDoc } from './firebase';

const RESERVATIONS_STORAGE_KEY = 'pizzeria-reservations';
const RESERVATION_SETTINGS_STORAGE_KEY = 'pizzeria-reservation-settings';
const RESERVATION_SETTINGS_DOC_ID = 'main';
const RESERVATION_SETTINGS_SHEET_NAME = 'ReservationSettings';
const SHEET_NAME = 'Reservations';

let reservationsCache: Reservation[] | null = null;

// Helper function to remove undefined properties from an object
const cleanUndefined = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

export const updateCaches = (reservations: Reservation[]) => {
    reservationsCache = reservations.sort((a, b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime());
    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservationsCache));
};

const initializeReservations = () => {
    try {
        const localData = localStorage.getItem(RESERVATIONS_STORAGE_KEY);
        if (localData) {
            reservationsCache = JSON.parse(localData);
        } else {
            reservationsCache = [];
        }
    } catch(e) {
        console.error(e);
        reservationsCache = [];
    }
};

initializeReservations();

const defaultReservationSettings: ReservationSettings = {
  duration: 90, 
  minBookingTime: 60,
  initialBlockTime: 60,
  extensionBlockTime: 30,
  modificationLockTime: 60,
  slotInterval: 30,
};

export const getReservationSettings = (): ReservationSettings => {
  try {
    const settingsJson = localStorage.getItem(RESERVATION_SETTINGS_STORAGE_KEY);
    return settingsJson ? { ...defaultReservationSettings, ...JSON.parse(settingsJson) } : defaultReservationSettings;
  } catch (error) {
    console.error("Failed to parse reservation settings from localStorage", error);
    return defaultReservationSettings;
  }
};

export const updateSettingsCache = (settings: ReservationSettings): void => {
  try {
    const currentSettings = getReservationSettings();
    localStorage.setItem(RESERVATION_SETTINGS_STORAGE_KEY, JSON.stringify({ ...currentSettings, ...settings }));
  } catch (error) {
    console.error("Failed to save reservation settings to localStorage", error);
  }
};

export const saveReservationSettings = async (settings: ReservationSettings): Promise<void> => {
  try {
    updateSettingsCache(settings);
    await setDoc(doc(db, RESERVATION_SETTINGS_SHEET_NAME, RESERVATION_SETTINGS_DOC_ID), settings);
  } catch (error) {
    console.error("Failed to save reservation settings", error);
    throw error;
  }
};

export const fetchAndCacheReservationSettings = async (): Promise<ReservationSettings> => {
    try {
        const docRef = doc(db, RESERVATION_SETTINGS_SHEET_NAME, RESERVATION_SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);

        let finalSettings = defaultReservationSettings;
        if (docSnap.exists()) {
            finalSettings = { ...defaultReservationSettings, ...docSnap.data() };
        } else {
            // If doesn't exist in Firebase, seed it from local or default
            const localSettings = getReservationSettings();
            await setDoc(docRef, localSettings);
            finalSettings = localSettings;
        }

        localStorage.setItem(RESERVATION_SETTINGS_STORAGE_KEY, JSON.stringify(finalSettings));
        return finalSettings;
    } catch (error) {
        console.warn('Failed to fetch reservation settings from Firebase, using local cache.', error);
        return getReservationSettings();
    }
};

export const getReservationsFromCache = (): Reservation[] => {
    return reservationsCache || [];
};

export const fetchAndCacheReservations = async (): Promise<Reservation[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getReservationsFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getReservationsFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const reservations = querySnapshot.docs.map(doc => doc.data() as Reservation);
        updateCaches(reservations);
        return reservations;
    } catch (error) {
        console.warn('Failed to fetch reservations from Firebase, using local cache.', error);
        return getReservationsFromCache();
    }
};


export const addReservation = async (reservationData: Omit<Reservation, 'id' | 'status' | 'createdAt' | 'statusHistory' | 'finishedAt'>): Promise<Reservation> => {
    const now = new Date().toISOString();
    const newReservation: Reservation = {
        ...reservationData,
        id: `RES-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        status: ReservationStatus.PENDING,
        createdAt: now,
        statusHistory: [{ status: ReservationStatus.PENDING, startedAt: now }],
        finishedAt: null,
    };
    
    try {
        await setDoc(doc(db, SHEET_NAME, newReservation.id), cleanUndefined(newReservation));
        updateCaches([newReservation, ...getReservationsFromCache()]);
        return newReservation;
    } catch (e) {
        throw new Error(`Error al guardar reserva en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const updateReservation = async (updatedReservation: Reservation): Promise<Reservation> => {
    try {
        await setDoc(doc(db, SHEET_NAME, updatedReservation.id), cleanUndefined(updatedReservation));
        const reservations = getReservationsFromCache();
        const reservationIndex = reservations.findIndex(r => r.id === updatedReservation.id);
        if (reservationIndex !== -1) {
            const newCache = [...reservations];
            newCache[reservationIndex] = updatedReservation;
            updateCaches(newCache);
        }
        return updatedReservation;
    } catch (e) {
        throw new Error(`Error al actualizar reserva en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const deleteReservation = async (reservationId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, SHEET_NAME, reservationId));
        updateCaches(getReservationsFromCache().filter(r => r.id !== reservationId));
    } catch (e) {
        throw new Error(`Error al eliminar reserva en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const updateReservationStatus = async (reservationId: string, status: ReservationStatus, cancellationReason?: ReservationCancellationReason): Promise<Reservation> => {
    const reservations = getReservationsFromCache();
    const reservationIndex = reservations.findIndex(r => r.id === reservationId);
    if (reservationIndex === -1) throw new Error(`Reservation with id ${reservationId} not found.`);

    const reservation = { ...reservations[reservationIndex] };
    const finishedStatuses: ReservationStatus[] = [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW];
    if (finishedStatuses.includes(reservation.status)) return reservation;

    reservation.status = status;
    reservation.statusHistory.push({ status, startedAt: new Date().toISOString() });
    if (status === ReservationStatus.CANCELLED) reservation.cancellationReason = cancellationReason;
    if (finishedStatuses.includes(status)) reservation.finishedAt = new Date().toISOString();
    
    addNotification({ message: `La reserva de ${reservation.customerName} cambió a: ${status}.`, type: 'reservation', relatedId: reservation.id });
    
    try {
        await setDoc(doc(db, SHEET_NAME, reservation.id), cleanUndefined(reservation));
        const newCache = [...reservations];
        newCache[reservationIndex] = reservation;
        updateCaches(newCache);
        return reservation;
    } catch (e) {
        throw new Error(`Error al actualizar estado en la nube: ${e instanceof Error ? e.message : String(e)}`);
    }
};


// The following functions use cache for synchronous performance
const timeToDate = (timeStr: string, date: Date): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
};

const getAvailableTablesAtTime = (time: Date, allTables: Table[], allReservations: Reservation[], reservationToIgnoreId?: string): Table[] => {
    const settings = getReservationSettings();
    const reservationEnd = new Date(time.getTime() + settings.duration * 60 * 1000);

    const reservedTableIds = new Set<string>();
    allReservations.forEach(res => {
        if (res.id !== reservationToIgnoreId && [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.SEATED].includes(res.status)) {
            const existingResStart = new Date(res.reservationTime);
            const existingResEnd = new Date(existingResStart.getTime() + settings.duration * 60 * 1000);
            if (time < existingResEnd && reservationEnd > existingResStart) {
                res.tableIds.forEach(id => reservedTableIds.add(id));
            }
        }
    });

    const allOrders = getOrdersFromCache();
    const occupiedTableIds = new Set<string>();
    allOrders.forEach(order => {
        if (order.type === OrderType.DINE_IN && !isOrderFinished(order.status) && order.tableIds) {
            const orderStart = new Date(order.createdAt);
            const orderEnd = new Date(orderStart.getTime() + settings.duration * 60 * 1000);
            if (time < orderEnd && reservationEnd > orderStart) {
                order.tableIds.forEach(id => occupiedTableIds.add(id));
            }
        }
    });

    return allTables.filter(table => 
        table.allowsReservations && 
        !reservedTableIds.has(table.id) &&
        !occupiedTableIds.has(table.id)
    );
};

export const findAvailableTables = (allTables: Table[], time: Date, guests: number, reservationToIgnoreId?: string): string[] | null => {
    const allReservations = getReservationsFromCache();
    const availableTables = getAvailableTablesAtTime(time, allTables, allReservations, reservationToIgnoreId);
    
    const singleFit = availableTables.filter(t => t.capacity >= guests).sort((a, b) => a.capacity - b.capacity)[0];
    if (singleFit) return [singleFit.id];
    
    const sortedTables = [...availableTables].sort((a, b) => b.capacity - a.capacity);
    const selectedTables: Table[] = [];
    let currentCapacity = 0;
    for (const table of sortedTables) {
        if (currentCapacity < guests) {
            selectedTables.push(table);
            currentCapacity += table.capacity;
        }
    }
    return currentCapacity >= guests ? selectedTables.map(t => t.id) : null;
};

export const getAvailability = (allTables: Table[], date: Date, guests: number): string[] => {
    const schedule = getScheduleFromCache();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    let daySchedule = schedule[dayName];
    const dateStr = date.toISOString().split('T')[0];

    const exceptions = getScheduleExceptionsFromCache();
    const applicableException = exceptions.find(ex => dateStr >= ex.startDate && dateStr <= ex.endDate);
    
    if (applicableException) {
        if (applicableException.type === ExceptionType.CLOSED) return [];
        if (applicableException.type === ExceptionType.SPECIAL_HOURS && applicableException.slots) {
            daySchedule = { isOpen: true, slots: applicableException.slots };
        }
    }

    const availableSlots: string[] = [];
    if (!daySchedule || !daySchedule.isOpen || guests <= 0) return availableSlots;

    const reservableTables = allTables.filter(t => t.allowsReservations);
    if (reservableTables.length === 0) return availableSlots;

    const settings = getReservationSettings();
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();

    for (const slot of daySchedule.slots) {
        let currentTime = timeToDate(slot.open, date);
        const endTime = timeToDate(slot.close, date);
        
        if (endTime <= currentTime) endTime.setDate(endTime.getDate() + 1);

        while (currentTime < endTime) {
            if (isToday && currentTime < new Date(now.getTime() + settings.minBookingTime * 60 * 1000)) {
                currentTime = new Date(currentTime.getTime() + settings.slotInterval * 60 * 1000);
                continue;
            }
            if (findAvailableTables(reservableTables, currentTime, guests)) {
                availableSlots.push(currentTime.toTimeString().slice(0, 5));
            }
            currentTime = new Date(currentTime.getTime() + settings.slotInterval * 60 * 1000);
        }
    }
    return availableSlots;
};
