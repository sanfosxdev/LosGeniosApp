import React, { useState, useEffect } from 'react';
import type { MenuItem, Category, Promotion } from '../types';
import { fetchAndCacheProducts } from '../services/productService';
import { fetchAndCacheCategories } from '../services/categoryService';
import { fetchAndCachePromotions } from '../services/promotionService';

const MenuItemCard: React.FC<{ item: MenuItem }> = ({ item }) => {
    return (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-white shadow-lg transition-all duration-300 hover:bg-white/20 hover:scale-105 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <h4 className="text-lg font-bold font-display pr-2">{item.name}</h4>
                <p className="text-md font-semibold text-secondary">${Number(item.price).toLocaleString('es-AR')}</p>
            </div>
            {item.description && <p className="text-white/80 mt-1 text-sm flex-grow">{item.description}</p>}
        </div>
    );
}

const MenuSection: React.FC = () => {
  const [menu, setMenu] = useState<{ [category: string]: MenuItem[] }>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMenuData = async () => {
        try {
            const [products, loadedCategories, allPromotions] = await Promise.all([
                fetchAndCacheProducts(),
                fetchAndCacheCategories(),
                fetchAndCachePromotions()
            ]);

            const activePromotions = allPromotions.filter(p => p.isActive);

            setCategories(loadedCategories);
            setPromotions(activePromotions);

            const groupedMenu = products.reduce((acc, product) => {
              const category = product.category;
              if (!acc[category]) {
                acc[category] = [];
              }
              acc[category].push({
                name: product.name,
                price: product.price,
                description: product.description,
              });
              return acc;
            }, {} as { [category: string]: MenuItem[] });

            setMenu(groupedMenu);
        } catch (error) {
            console.error("Failed to load menu data", error);
            // Data will be loaded from cache by the services if API fails
        } finally {
            setIsLoading(false);
        }
    };
    
    loadMenuData();
  }, []);

  const promotionItems: MenuItem[] = promotions.map(promo => ({
    name: promo.name,
    price: promo.price.toString(),
    description: promo.items.map(item => `${item.quantity}x ${item.name}`).join(' + '),
  }));

  return (
    <section id="menu" className="bg-dark">
      <div className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold font-display text-white mb-4">Nuestro Delicioso Menú</h2>
        <p className="text-lg text-light max-w-3xl mx-auto">Explora nuestras especialidades, preparadas con los ingredientes más frescos.</p>
      </div>
      
      {isLoading ? (
          <div className="text-center text-white py-20">Cargando menú...</div>
      ) : (
        <>
          {promotionItems.length > 0 && (
            <div 
              className="relative py-20 lg:py-32 bg-cover bg-center bg-fixed"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555529771-835f5de6b662?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=870&q=80')` }}
            >
              <div className="absolute inset-0 bg-black/70"></div>
              <div className="relative z-10 container mx-auto px-6 flex flex-col items-center">
                <h3 className="text-4xl lg:text-5xl font-bold font-display text-white mb-12 text-center inline-block border-b-4 border-secondary pb-2">
                  Promociones 🎁
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
                  {promotionItems.map((item) => (
                    <MenuItemCard key={item.name} item={item} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {Object.keys(menu).length === 0 && promotionItems.length === 0 ? (
              <div className="text-center text-white py-20">No hay productos en el menú.</div>
          ) : (
            Object.entries(menu).map(([categoryName, items]: [string, MenuItem[]]) => {
              const categoryData = categories.find(c => c.name === categoryName);
              const imageUrl = categoryData?.imageUrl;
              
              return (
              <div 
                key={categoryName} 
                className="relative py-20 lg:py-32 bg-cover bg-center bg-fixed"
                style={{ backgroundImage: imageUrl ? `url('${imageUrl}')` : 'none', backgroundColor: !imageUrl ? '#1A202C' : 'transparent' }}
              >
                <div className="absolute inset-0 bg-black/60"></div>
                <div className="relative z-10 container mx-auto px-6 flex flex-col items-center">
                  <h3 className="text-4xl lg:text-5xl font-bold font-display text-white mb-12 text-center inline-block border-b-4 border-secondary pb-2">
                    {categoryName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
                    {items.map((item) => (
                      <MenuItemCard key={item.name} item={item} />
                    ))}
                  </div>
                </div>
              </div>
              )
            })
          )}
        </>
      )}
    </section>
  );
};

export default MenuSection;