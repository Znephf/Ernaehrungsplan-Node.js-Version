import React from 'react';
import type { PlanSettings, MealCategory } from '../types';
import { MealCategoryLabels } from '../types';

interface SettingsPanelProps {
  settings: PlanSettings;
  onSettingsChange: (settings: PlanSettings) => void;
  onGeneratePlan: () => void;
  isLoading: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onGeneratePlan, isLoading }) => {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const target = e.target as HTMLInputElement;

    onSettingsChange({
        ...settings,
        [name]: isCheckbox
            ? target.checked
            : (name === 'persons' || name === 'kcal')
                ? Number(value)
                : value,
    });
  };

  const handleMealTypeChange = (mealType: MealCategory) => {
    const currentMeals = settings.includedMeals || [];
    const newMeals = currentMeals.includes(mealType)
      ? currentMeals.filter(m => m !== mealType)
      : [...currentMeals, mealType];
    onSettingsChange({ ...settings, includedMeals: newMeals });
  };
  
  const handlePersonStep = (amount: number) => onSettingsChange({ ...settings, persons: Math.max(1, (settings.persons || 1) + amount) });
  const handleKcalStep = (amount: number) => onSettingsChange({ ...settings, kcal: Math.max(1000, (settings.kcal || 1000) + amount) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGeneratePlan();
  };

  const showMainMealFocus = (settings.includedMeals || []).includes('lunch') && (settings.includedMeals || []).includes('dinner');

  const inputStyles = "mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm";
  const stepButtonStyles = "px-4 bg-slate-200 text-slate-700 font-bold border border-slate-300 hover:bg-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:z-10 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Column 1 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="persons" className="block text-sm font-medium text-slate-700">Anzahl Personen</label>
            <div className="flex items-center mt-1">
                  <button type="button" onClick={() => handlePersonStep(-1)} className={`${stepButtonStyles} rounded-l-md h-10`} aria-label="Anzahl Personen verringern">−</button>
                  <input type="number" name="persons" id="persons" value={settings.persons} onChange={handleChange} min="1" className="w-full text-center h-10 border-t border-b border-slate-300" />
                  <button type="button" onClick={() => handlePersonStep(1)} className={`${stepButtonStyles} rounded-r-md h-10`} aria-label="Anzahl Personen erhöhen">+</button>
              </div>
          </div>
          <div>
              <label htmlFor="kcal" className="block text-sm font-medium text-slate-700">Kcal pro Tag/Person</label>
              <div className="flex items-center mt-1">
                  <button type="button" onClick={() => handleKcalStep(-50)} className={`${stepButtonStyles} rounded-l-md h-10`} aria-label="Kalorien verringern">−</button>
                  <input type="number" name="kcal" id="kcal" value={settings.kcal} onChange={handleChange} step="50" min="1000" className="w-full text-center h-10 border-t border-b border-slate-300" />
                  <button type="button" onClick={() => handleKcalStep(50)} className={`${stepButtonStyles} rounded-r-md h-10`} aria-label="Kalorien erhöhen">+</button>
              </div>
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="dietaryPreference" className="block text-sm font-medium text-slate-700">Ernährungsweise</label>
            <select name="dietaryPreference" id="dietaryPreference" value={settings.dietaryPreference} onChange={handleChange} className={`${inputStyles} capitalize`}>
              <option value="omnivore">Alles</option>
              <option value="vegetarian">Vegetarisch</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>
          <div>
            <label htmlFor="dishComplexity" className="block text-sm font-medium text-slate-700">Koch-Niveau</label>
            <select name="dishComplexity" id="dishComplexity" value={settings.dishComplexity} onChange={handleChange} className={inputStyles}>
              <option value="simple">Einfache Gerichte</option>
              <option value="advanced">Fortgeschrittene Gerichte</option>
              <option value="fancy">Pfiffige Gerichte</option>
            </select>
          </div>
        </div>
        
        {/* Column 3 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="dietType" className="block text-sm font-medium text-slate-700">Diät-Typ</label>
            <select name="dietType" id="dietType" value={settings.dietType} onChange={handleChange} className={`${inputStyles} capitalize`}>
              <option value="balanced">Ausgewogen</option>
              <option value="low-carb">Low-Carb</option>
              <option value="keto">Ketogen</option>
              <option value="high-protein">High-Protein</option>
              <option value="mediterranean">Mediterran</option>
            </select>
          </div>
          <div className="pt-1">
            <span className="block text-sm font-medium text-slate-700">Optionen</span>
            <div className="mt-2 flex items-center space-x-6">
                <label htmlFor="isGlutenFree" className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="isGlutenFree" id="isGlutenFree" checked={settings.isGlutenFree} onChange={handleChange} className="h-4 w-4 rounded" /><span>Glutenfrei</span></label>
                <label htmlFor="isLactoseFree" className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="isLactoseFree" id="isLactoseFree" checked={settings.isLactoseFree} onChange={handleChange} className="h-4 w-4 rounded" /><span>Laktosefrei</span></label>
            </div>
          </div>
        </div>
      </div>

      {/* Meal Selection Row */}
      <div className="pt-2">
        <label className="block text-sm font-medium text-slate-700 mb-2">Enthaltene Mahlzeiten</label>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(MealCategoryLabels) as MealCategory[]).map(mealType => (
            <label key={mealType} className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md transition-colors has-[:checked]:bg-emerald-100 has-[:checked]:text-emerald-800 has-[:checked]:ring-1 has-[:checked]:ring-emerald-300">
                <input
                    type="checkbox"
                    checked={(settings.includedMeals || []).includes(mealType)}
                    onChange={() => handleMealTypeChange(mealType)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{MealCategoryLabels[mealType]}</span>
            </label>
          ))}
        </div>
      </div>

      {showMainMealFocus && (
        <div className="pt-2">
          <label className="block text-sm font-medium text-slate-700">Hauptmahlzeit-Fokus</label>
          <p className="text-xs text-slate-500 mt-1 mb-2">Wenn Mittag- & Abendessen gewählt sind, welche Mahlzeit soll üppiger ausfallen?</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(['none', 'lunch', 'dinner'] as const).map(focus => (
              <label key={focus} className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="radio"
                  name="mainMealFocus"
                  value={focus}
                  checked={(settings.mainMealFocus || 'none') === focus}
                  onChange={handleChange}
                  className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{focus === 'none' ? 'Kein Fokus' : (focus === 'lunch' ? 'Mittagessen' : 'Abendessen')}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      {/* Full width rows */}
      <div>
        <label htmlFor="desiredIngredients" className="block text-sm font-medium text-slate-700">Gewünschte Zutaten</label>
        <textarea name="desiredIngredients" id="desiredIngredients" value={settings.desiredIngredients} onChange={handleChange} rows={2} placeholder="z.B. Lachs, Avocado, Süßkartoffeln" className={inputStyles}></textarea>
      </div>
      <div>
        <label htmlFor="excludedIngredients" className="block text-sm font-medium text-slate-700">Ausgeschlossene Zutaten</label>
        <textarea name="excludedIngredients" id="excludedIngredients" value={settings.excludedIngredients} onChange={handleChange} rows={2} placeholder="z.B. Pilze, Nüsse, Koriander" className={inputStyles}></textarea>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isLoading} className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
          {isLoading ? 'Generiere...' : 'Plan generieren'}
        </button>
      </div>
    </form>
  );
};

export default SettingsPanel;