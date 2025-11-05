import type { Table, EnrichedTable, Order, Reservation } from '../types';
import { OrderType, ReservationStatus } from '../types';
import { getOrdersFromCache, isOrderFinished } from './orderService';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const TABLES_STORAGE_KEY = 'pizzeria-tables';
const SHEET_NAME = 'Tables';

let tablesCache: Table[] | null = null;

export const updateCaches = (tables: Table[]) => {
    tablesCache = tables.sort((a,b) => a.name.localeCompare(b.name));
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tablesCache));
};

const initialTables: Table[] = [
  { id: 'T1', name: 'Mesa 1', capacity: 4, allowsReservations: true, overrideStatus: null },
  { id: 'T2', name: 'Mesa 2', capacity: 4, allowsReservations: true, overrideStatus: null },
  { id: 'T3', name: 'Mesa 3', capacity: 2, allowsReservations: true, overrideStatus: null },
  { id: 'T4', name: 'Mesa 4', capacity: 6, allowsReservations: true, overrideStatus: null },
  { id: 'T5', name: 'Barra 1', capacity: 1, allowsReservations: false, overrideStatus: null },
];

const initializeTables = () => {
  try {
    const tablesJson = localStorage.getItem(TABLES_STORAGE_KEY);
    if (!tablesJson) {
      updateCaches(initialTables);
    } else {
      const tables = JSON.parse(tablesJson) as Table[];
      // Migration for tables without new properties
      tables.forEach(table => {
          if (table.allowsReservations === undefined) table.allowsReservations = true;
          if (table.overrideStatus === undefined) table.overrideStatus = null;
      });
      updateCaches(tables);
    }
  } catch (error) {
    console.error("Failed to initialize tables in localStorage", error);
  }
};

initializeTables();

export const getTablesFromCache = (): Table[] => {
    return tablesCache || [];
};

export const fetchAndCacheTables = async (): Promise<Table[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getTablesFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getTablesFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const tables = querySnapshot.docs.map(doc => doc.data() as Table);
        updateCaches(tables);
        return tables;
    } catch(e) {
        console.warn("Could not fetch tables from Firebase, using local cache.", e);
        return getTablesFromCache();
    }
};

export const addTable = async (tableData: Omit<Table, 'id'>): Promise<Table> => {
  const newTable: Table = {
    ...tableData,
    id: `TBL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    overrideStatus: null
  };

  try {
    await setDoc(doc(db, SHEET_NAME, newTable.id), newTable);
    updateCaches([...getTablesFromCache(), newTable]);
    return newTable;
  } catch (e) {
    throw new Error(`Failed to save table: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updateTable = async (updatedTable: Table): Promise<Table> => {
  try {
    await setDoc(doc(db, SHEET_NAME, updatedTable.id), updatedTable);
    const tables = getTablesFromCache();
    const tableIndex = tables.findIndex(t => t.id === updatedTable.id);
    if (tableIndex !== -1) {
        const newCache = [...tables];
        newCache[tableIndex] = updatedTable;
        updateCaches(newCache);
    }
    return updatedTable;
  } catch (e) {
    throw new Error(`Failed to update table: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const setTableOverrideStatus = async (tableId: string, status: 'Bloqueada' | null): Promise<Table> => {
    const tables = getTablesFromCache();
    const tableIndex = tables.findIndex(t => t.id === tableId);
    if (tableIndex === -1) throw new Error("Table not found");

    const tableToUpdate = { ...tables[tableIndex], overrideStatus: status };
    return updateTable(tableToUpdate);
};

export const deleteTable = async (tableId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SHEET_NAME, tableId));
    updateCaches(getTablesFromCache().filter(t => t.id !== tableId));
  } catch (e) {
    throw new Error(`Failed to delete table: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const enrichTables = (tables: Table[], orders: Order[], reservations: Reservation[]): EnrichedTable[] => {
    const now = new Date();
    const reservationWindowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const blockWindowEnd = new Date(now.getTime() + 60 * 60 * 1000);

    const activeDineInOrders = orders.filter(o => o.tableIds && o.type === OrderType.DINE_IN && !isOrderFinished(o.status));
    const confirmedReservations = reservations.filter(r => r.tableIds && r.status === ReservationStatus.CONFIRMED);
    
    const ordersByTableMap = new Map<string, Order[]>();
    activeDineInOrders.forEach(order => {
        order.tableIds?.forEach(tableId => {
            const existing = ordersByTableMap.get(tableId) || [];
            ordersByTableMap.set(tableId, [...existing, order]);
        });
    });

    const blockedTableMap = new Map<string, Reservation>();
    const reservedTableMap = new Map<string, Reservation>();

    confirmedReservations.forEach(res => {
        const resTime = new Date(res.reservationTime);
        if (resTime > now && resTime <= blockWindowEnd) {
            res.tableIds.forEach(tableId => blockedTableMap.set(tableId, res));
        } else if (resTime > blockWindowEnd && resTime <= reservationWindowEnd) {
            res.tableIds.forEach(tableId => reservedTableMap.set(tableId, res));
        }
    });

    return tables.map(table => {
        if (table.overrideStatus === 'Bloqueada') {
            return { ...table, status: 'Bloqueada', details: { type: 'order', id: 'manual', customerName: 'Administrador' } };
        }

        const activeOrdersOnTable = ordersByTableMap.get(table.id);
        if (activeOrdersOnTable && activeOrdersOnTable.length > 0) {
            const oldestOrder = activeOrdersOnTable.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
            const accumulatedTotal = activeOrdersOnTable.reduce((sum, order) => sum + order.total, 0);
            
            return {
                ...table, status: 'Ocupada',
                activeOrdersOnTable,
                accumulatedTotal,
                details: { 
                  type: 'order', id: oldestOrder.id, customerName: oldestOrder.customer.name,
                  startTime: oldestOrder.createdAt,
                  orderStatus: oldestOrder.status
                }
            };
        }
        if (blockedTableMap.has(table.id)) {
            const reservation = blockedTableMap.get(table.id)!;
            return {
                ...table, status: 'Bloqueada',
                details: {
                    type: 'reservation', id: reservation.id, customerName: reservation.customerName,
                    time: new Date(reservation.reservationTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                }
            };
        }
        if (reservedTableMap.has(table.id)) {
            const reservation = reservedTableMap.get(table.id)!;
            return {
                ...table, status: 'Reservada',
                details: {
                    type: 'reservation', id: reservation.id, customerName: reservation.customerName,
                    time: new Date(reservation.reservationTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                }
            };
        }
        return { ...table, status: 'Libre' };
    });
};

export const getEnrichedTableById = (tableId: string, allOrders: Order[], allReservations: Reservation[]): EnrichedTable | null => {
    const allTables = getTablesFromCache();
    const table = allTables.find(t => t.id === tableId);
    if (!table) return null;
    
    const enriched = enrichTables([table], allOrders, allReservations);
    return enriched[0] || null;
}

// Functions below use cache for synchronous performance in UI logic
export const getAvailableTablesForDineIn = (allReservations: Reservation[], reservationToIgnoreId?: string): Table[] => {
    const allTables = getTablesFromCache();
    const allOrders = getOrdersFromCache();
    const now = new Date();
    const blockWindowEnd = new Date(now.getTime() + 60 * 60 * 1000);

    const occupiedTableIds = new Set(
        allOrders
            .filter(o => o.tableIds && o.tableIds.length > 0 && o.type === OrderType.DINE_IN && !isOrderFinished(o.status))
            .flatMap(o => o.tableIds!)
    );

    const blockedTableIds = new Set(
        allReservations
            .filter(r => {
                const resTime = new Date(r.reservationTime);
                return r.id !== reservationToIgnoreId && r.tableIds && r.tableIds.length > 0 && r.status === ReservationStatus.CONFIRMED && resTime > now && resTime <= blockWindowEnd;
            })
            .flatMap(r => r.tableIds!)
    );
    
    return allTables.filter(table => 
        table.overrideStatus !== 'Bloqueada' &&
        !occupiedTableIds.has(table.id) && 
        !blockedTableIds.has(table.id)
    );
};
