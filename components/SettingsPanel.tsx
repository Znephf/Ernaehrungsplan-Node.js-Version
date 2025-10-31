
import React from 'react';
import type { PlanSettings } from '../types';

interface SettingsPanelProps {
  settings: PlanSettings;
  onSettingsChange: (settings: PlanSettings) => void;
  onGeneratePlan: () => void;
  isLoading: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onGeneratePlan, isLoading }) => {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onSettingsChange({
      ...settings,
      [name]: (name === 'persons' || name === 'kcal') ? Number(value) : value,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGeneratePlan();
  };

  const inputStyles = "mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {/* Column 1 */}
      <div className="space-y-4">
        <div>
          <label htmlFor="persons" className="block text-sm font-medium text-slate-700">Anzahl Personen</label>
          <input type="number" name="persons" id="persons" value={settings.persons} onChange={handleChange} min="1" className={inputStyles} />
        </div>
        <div>
          <label htmlFor="kcal" className="block text-sm font-medium text-slate-700">Kcal pro Tag/Person</label>
          <input type="number" name="kcal" id="kcal" value={settings.kcal} onChange={handleChange} step="50" min="1000" className={inputStyles} />
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
          <label htmlFor="dietType" className="block text-sm font-medium text-slate-700">Diät-Typ</label>
          <select name="dietType" id="dietType" value={settings.dietType} onChange={handleChange} className={`${inputStyles} capitalize`}>
            <option value="balanced">Ausgewogen</option>
            <option value="low-carb">Low-Carb</option>
            <option value="keto">Ketogen</option>
            <option value="high-protein">High-Protein</option>
            <option value="mediterranean">Mediterran</option>
          </select>
        </div>
      </div>
      
      {/* Column 3 */}
      <div className="space-y-4">
          <div>
          <label htmlFor="breakfastOption" className="block text-sm font-medium text-slate-700">Frühstücks-Option</label>
          <select name="breakfastOption" id="breakfastOption" value={settings.breakfastOption} onChange={handleChange} className={`${inputStyles} capitalize`}>
            <option value="quark">Quark-basiert</option>
            <option value="muesli">Müsli-basiert</option>
            <option value="custom">Eigene Angabe</option>
          </select>
        </div>
        {settings.breakfastOption === 'custom' && (
          <div>
            <label htmlFor="customBreakfast" className="block text-sm font-medium text-slate-700">Eigene Frühstücks-Angabe</label>
            <input type="text" name="customBreakfast" id="customBreakfast" value={settings.customBreakfast} onChange={handleChange} placeholder="z.B. Rührei mit Speck" className={inputStyles} />
          </div>
        )}
      </div>
      
      {/* Full width rows */}
       <div className="md:col-span-2 lg:col-span-3">
        <label htmlFor="desiredIngredients" className="block text-sm font-medium text-slate-700">Gewünschte Zutaten</label>
        <textarea name="desiredIngredients" id="desiredIngredients" value={settings.desiredIngredients} onChange={handleChange} rows={2} placeholder="z.B. Lachs, Avocado, Süßkartoffeln" className={inputStyles}></textarea>
        <p className="mt-1 text-xs text-slate-500">Zutaten, die mindestens einmal vorkommen sollen. Durch Komma trennen.</p>
      </div>

      <div className="md:col-span-2 lg:col-span-3">
        <label htmlFor="excludedIngredients" className="block text-sm font-medium text-slate-700">Ausgeschlossene Zutaten</label>
        <textarea name="excludedIngredients" id="excludedIngredients" value={settings.excludedIngredients} onChange={handleChange} rows={2} placeholder="z.B. Pilze, Nüsse, Koriander" className={inputStyles}></textarea>
        <p className="mt-1 text-xs text-slate-500">Einzelne Zutaten oder Gruppen durch Komma trennen.</p>
      </div>

      <div className="md:col-span-2 lg:col-span-3 flex justify-end">
        <button type="submit" disabled={isLoading} className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
          {isLoading ? 'Generiere...' : 'Plan generieren'}
        </button>
      </div>
    </form>
  );
};

export default SettingsPanel;
