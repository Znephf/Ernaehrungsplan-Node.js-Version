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
    const { name, value, type } = e.target;
    
    // Assert that the target is an HTMLInputElement for checkbox handling
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
  
  const handlePersonStep = (amount: number) => {
    const currentPersons = settings.persons || 1;
    let newPersons = currentPersons + amount;
    if (newPersons < 1) {
        newPersons = 1;
    }
    onSettingsChange({ ...settings, persons: newPersons });
  };

  const handlePersonBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    if (isNaN(numValue) || numValue < 1) {
        onSettingsChange({ ...settings, persons: 1 });
    }
  };
  
  const handleKcalStep = (amount: number) => {
    const currentKcal = settings.kcal || 1000;
    let newKcal = currentKcal + amount;
    if (newKcal < 1000) {
        newKcal = 1000;
    }
    onSettingsChange({ ...settings, kcal: newKcal });
  };

  const handleKcalBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    if (!isNaN(numValue) && numValue < 1000) {
        onSettingsChange({ ...settings, kcal: 1000 });
    } else if (e.target.value === '' || isNaN(numValue)) {
        onSettingsChange({ ...settings, kcal: 1000 });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGeneratePlan();
  };

  const inputStyles = "mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm";
  const stepButtonStyles = "px-4 bg-slate-200 text-slate-700 font-bold border border-slate-300 hover:bg-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:z-10 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {/* Column 1 */}
      <div className="space-y-4">
        <div>
          <label htmlFor="persons" className="block text-sm font-medium text-slate-700">Anzahl Personen</label>
          <div className="flex items-center mt-1">
                <button type="button" onClick={() => handlePersonStep(-1)} className={`${stepButtonStyles} rounded-l-md h-10`} aria-label="Anzahl Personen um 1 verringern">−</button>
                <input 
                    type="number" 
                    name="persons" 
                    id="persons" 
                    value={settings.persons === 0 ? '' : settings.persons} 
                    onChange={handleChange} 
                    onBlur={handlePersonBlur}
                    step="1" 
                    min="1" 
                    className="w-full text-center appearance-none bg-white text-slate-900 border-t border-b border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 focus:z-10 sm:text-sm h-10"
                    style={{ MozAppearance: 'textfield' }}
                />
                <button type="button" onClick={() => handlePersonStep(1)} className={`${stepButtonStyles} rounded-r-md h-10`} aria-label="Anzahl Personen um 1 erhöhen">+</button>
            </div>
        </div>
        <div>
            <label htmlFor="kcal" className="block text-sm font-medium text-slate-700">Kcal pro Tag/Person</label>
            <div className="flex items-center mt-1">
                <button type="button" onClick={() => handleKcalStep(-50)} className={`${stepButtonStyles} rounded-l-md h-10`} aria-label="Kalorien um 50 verringern">−</button>
                <input 
                    type="number" 
                    name="kcal" 
                    id="kcal" 
                    value={settings.kcal === 0 ? '' : settings.kcal} 
                    onChange={handleChange} 
                    onBlur={handleKcalBlur}
                    step="50" 
                    min="1000" 
                    className="w-full text-center appearance-none bg-white text-slate-900 border-t border-b border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 focus:z-10 sm:text-sm h-10"
                    style={{ MozAppearance: 'textfield' }} // Spinner auf Firefox ausblenden
                />
                <button type="button" onClick={() => handleKcalStep(50)} className={`${stepButtonStyles} rounded-r-md h-10`} aria-label="Kalorien um 50 erhöhen">+</button>
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

      {/* New Checkbox Row */}
      <div className="md:col-span-2 lg:col-span-3 flex items-center space-x-6 pt-2">
            <label htmlFor="isGlutenFree" className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                    type="checkbox"
                    name="isGlutenFree"
                    id="isGlutenFree"
                    checked={settings.isGlutenFree}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Glutenfrei</span>
            </label>
            <label htmlFor="isLactoseFree" className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                    type="checkbox"
                    name="isLactoseFree"
                    id="isLactoseFree"
                    checked={settings.isLactoseFree}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Laktosefrei</span>
            </label>
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