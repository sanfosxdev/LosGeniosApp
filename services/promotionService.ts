import type { Promotion } from '../types';
import { db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from './firebase';

const PROMOTIONS_STORAGE_KEY = 'pizzeria-promotions';
const SHEET_NAME = 'Promotions';

let promotionsCache: Promotion[] | null = null;

export const updateCaches = (promotions: Promotion[]) => {
    promotionsCache = promotions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    localStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(promotionsCache));
};

const initializePromotions = () => {
    try {
        const localData = localStorage.getItem(PROMOTIONS_STORAGE_KEY);
        if (localData) {
            promotionsCache = JSON.parse(localData);
        } else {
            promotionsCache = [];
        }
    } catch(e) {
        console.error(e);
        promotionsCache = [];
    }
};

initializePromotions();

export const getPromotionsFromCache = (): Promotion[] => {
    return promotionsCache || [];
};

export const fetchAndCachePromotions = async (): Promise<Promotion[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, SHEET_NAME));
        
        if (querySnapshot.empty && getPromotionsFromCache().length > 0) {
            console.log(`Firebase collection '${SHEET_NAME}' is empty. Seeding from local storage.`);
            const localData = getPromotionsFromCache();
            const batch = writeBatch(db);
            localData.forEach(item => {
                const docRef = doc(db, SHEET_NAME, item.id);
                batch.set(docRef, item);
            });
            await batch.commit();
            return localData;
        }

        const promotions = querySnapshot.docs.map(doc => doc.data() as Promotion);
        updateCaches(promotions);
        return promotions;
    } catch (error) {
        console.warn('Failed to fetch promotions from Firebase, using local cache.', error);
        return getPromotionsFromCache();
    }
};

export const addPromotion = async (promotionData: Omit<Promotion, 'id' | 'createdAt'>): Promise<Promotion> => {
  const newPromotion: Promotion = {
    ...promotionData,
    id: `PROMO-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  try {
      await setDoc(doc(db, SHEET_NAME, newPromotion.id), newPromotion);
      updateCaches([newPromotion, ...getPromotionsFromCache()]);
      return newPromotion;
  } catch (e) {
      throw new Error(`Error al guardar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updatePromotion = async (updatedPromotion: Promotion): Promise<Promotion> => {
  try {
      await setDoc(doc(db, SHEET_NAME, updatedPromotion.id), updatedPromotion);
      const promotions = getPromotionsFromCache();
      const promotionIndex = promotions.findIndex(p => p.id === updatedPromotion.id);
      if (promotionIndex !== -1) {
        const newCache = [...promotions];
        newCache[promotionIndex] = updatedPromotion;
        updateCaches(newCache);
      }
      return updatedPromotion;
  } catch (e) {
      throw new Error(`Error al actualizar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deletePromotion = async (promotionId: string): Promise<void> => {
  try {
      await deleteDoc(doc(db, SHEET_NAME, promotionId));
      updateCaches(getPromotionsFromCache().filter(p => p.id !== promotionId));
  } catch (e) {
      throw new Error(`Error al eliminar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};
