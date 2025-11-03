import React from 'react';
import type { Product, Promotion, Category } from '../../types';
import { PizzaIcon } from '../icons/PizzaIcon';

interface MenuGeneratorProps {
  products: Product[];
  promotions: Promotion[];
  categories: Category[];
}

const MenuGenerator: React.FC<MenuGeneratorProps> = ({ products, promotions, categories }) => {
    
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as { [category: string]: Product[] });

  return (
    <div id="menu-to-export" className="p-8 bg-gray-100 font-sans" style={{ width: '800px' }}>
      <header className="text-center mb-8 border-b-2 border-gray-300 pb-4">
        <PizzaIcon className="w-16 h-16 text-primary mx-auto mb-2" />
        <h1 className="text-5xl font-bold font-display text-gray-800">Pizzería Los Genios</h1>
        <p className="text-xl text-gray-600 mt-2">Nuestro Menú</p>
      </header>
      
      <main className="space-y-8">
        {promotions.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold font-display text-primary mb-4 border-l-4 border-primary pl-3">
              Promociones 🎁
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {promotions.map(promo => (
                <div key={promo.id} className="flex flex-col">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-lg font-semibold text-gray-800">{promo.name}</h3>
                    <span className="flex-grow border-b border-dashed border-gray-300 mx-2"></span>
                    <p className="text-lg font-bold text-gray-800">${promo.price.toLocaleString('es-AR')}</p>
                  </div>
                  <p className="text-sm text-gray-600">{promo.items.map(i => `${i.quantity}x ${i.name}`).join(' + ')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {Object.entries(groupedProducts).map(([categoryName, items]: [string, Product[]]) => (
            <section key={categoryName}>
                <h2 className="text-3xl font-bold font-display text-primary mb-4 border-l-4 border-primary pl-3">
                {categoryName}
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {items.map(item => (
                    <div key={item.id} className="flex flex-col">
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                         <span className="flex-grow border-b border-dashed border-gray-300 mx-2"></span>
                        <p className="text-lg font-bold text-gray-800">${Number(item.price).toLocaleString('es-AR')}</p>
                      </div>
                      {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
                    </div>
                ))}
                </div>
            </section>
        ))}
      </main>
      
      <footer className="text-center mt-8 pt-4 border-t-2 border-gray-300">
        <p className="text-sm text-gray-500">Precios válidos a la fecha de emisión. ¡Gracias por elegirnos!</p>
      </footer>
    </div>
  );
};

export default MenuGenerator;