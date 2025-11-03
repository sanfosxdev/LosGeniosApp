import type { Promotion } from '../types';
import apiService from './apiService';

const PROMOTIONS_STORAGE_KEY = 'pizzeria-promotions';
const SHEET_NAME = 'Promotions';

let promotionsCache: Promotion[] | null = null;

const updateCaches = (promotions: Promotion[]) => {
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
        const promotions = await apiService.get(SHEET_NAME);
        updateCaches(promotions);
        return promotions;
    } catch (error) {
        console.warn('Failed to fetch promotions, using local cache.', error);
        return getPromotionsFromCache();
    }
};

export const addPromotion = async (promotionData: Omit<Promotion, 'id' | 'createdAt'>): Promise<Promotion> => {
  const newPromotion: Promotion = {
    ...promotionData,
    id: `PROMO-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  updateCaches([newPromotion, ...getPromotionsFromCache()]);

  try {
      await apiService.post('addData', { sheetName: SHEET_NAME, item: newPromotion });
      return newPromotion;
  } catch (e) {
      throw new Error(`Error al guardar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const updatePromotion = async (updatedPromotion: Promotion): Promise<Promotion> => {
  const promotions = getPromotionsFromCache();
  const promotionIndex = promotions.findIndex(p => p.id === updatedPromotion.id);
  if (promotionIndex === -1) throw new Error("Promotion not found");

  const newCache = [...promotions];
  newCache[promotionIndex] = updatedPromotion;
  updateCaches(newCache);
  
  try {
      await apiService.post('updateData', { sheetName: SHEET_NAME, item: updatedPromotion });
      return updatedPromotion;
  } catch (e) {
      throw new Error(`Error al actualizar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export const deletePromotion = async (promotionId: string): Promise<void> => {
  updateCaches(getPromotionsFromCache().filter(p => p.id !== promotionId));
  try {
      await apiService.post('deleteData', { sheetName: SHEET_NAME, itemId: promotionId });
  } catch (e) {
      throw new Error(`Error al eliminar promoción en la nube: ${e instanceof Error ? e.message : String(e)}`);
  }
};
