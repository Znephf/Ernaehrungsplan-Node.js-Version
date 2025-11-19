// Fix: Implemented the ShoppingList component to display the shopping list for a meal plan.
import React from 'react';
import type { ShoppingList } from '../types';

interface ShoppingListComponentProps {
  shoppingList: ShoppingList;
}

const ShoppingListComponent: React.FC<ShoppingListComponentProps> = ({ shoppingList }) => {
  if (!shoppingList || shoppingList.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100 mb-2">Keine Einkaufsliste vorhanden</h2>
        <p className="text-slate-500 dark:text-slate-400">Für diesen Plan konnte keine Einkaufsliste gefunden werden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-100">Wöchentliche Einkaufsliste</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Eine praktische Liste für deinen Einkauf.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shoppingList.map(({ category, items }, index) => (
          <div key={index} className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-200 dark:border-emerald-900 pb-2 mb-4">{category}</h3>
            <ul className="space-y-2">
              {(items || []).map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start">
                  <label className="flex items-center cursor-pointer select-none group">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 mt-1 bg-white dark:bg-slate-700"
                    />
                    <span className="ml-3 text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors group-has-[:checked]:line-through group-has-[:checked]:text-slate-400 dark:group-has-[:checked]:text-slate-600">
                      {item}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShoppingListComponent;