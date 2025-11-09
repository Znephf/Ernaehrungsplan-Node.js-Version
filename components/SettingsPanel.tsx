import React, { useState, useMemo } from 'react';
import type { PlanSettings, MealCategory, Recipe } from '../types';
import { MealCategoryLabels } from '../types';
import CustomSelect from './CustomSelect';
import { CloseIcon } from './IconComponents';


// Recipe Selector Modal Component (defined in the same file to minimize changes)
interface RecipeSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipes: Recipe[];
    mealCategory: MealCategory;
    onSelect: (recipe: Recipe) => void;
}

const RecipeSelectorModal: React.FC<RecipeSelectorModalProps> = ({ isOpen, onClose, recipes, mealCategory, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRecipes = useMemo(() => {
        return recipes.filter(r => 
            r.category === mealCategory &&
            r.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [recipes, mealCategory, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Wähle ein {MealCategoryLabels[mealCategory]}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button>
                </header>
                <div className="p-4 border-b">
                    <input 
                        type="text"
                        placeholder="Suche nach Titel..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
                    />
                </div>
                <ul className="overflow-y-auto p-2">
                    {filteredRecipes.length > 0 ? filteredRecipes.map(recipe => (
                        <li key={recipe.id} onClick={() => onSelect(recipe)} className="flex items-center gap-4 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                           {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}
                           <div>
                                <p className="font-semibold text-slate-800">{recipe.title}</p>
                                <p className="text-sm text-slate-500">{recipe.totalCalories} kcal</p>
                           </div>
                        </li>
                    )) : (
                        <p className="text-center text-slate-500 p-8">Keine passenden Rezepte gefunden.</p>
                    )}
                </ul>
            </div>
        </div>
    );
};


interface SettingsPanelProps {
  settings: PlanSettings;
  allRecipes: Recipe[];
  onSettingsChange: (settings: PlanSettings) => void;
  onGeneratePlan: () => void;
  isLoading: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, allRecipes, onSettingsChange, onGeneratePlan, isLoading }) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorMealType, setSelectorMealType] = useState<MealCategory>('breakfast');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const target = e.target as HTMLInputElement;

    const newSettings = { ...settings };
    
    // Clear selected recipe if custom text is being entered
    if (name === 'customBreakfastText' && value) newSettings.selectedBreakfastRecipeId = null;
    if (name === 'customSnackText' && value) newSettings.selectedSnackRecipeId = null;
    if (name === 'customCoffeeText' && value) newSettings.selectedCoffeeRecipeId = null;

    onSettingsChange({
        ...newSettings,
        [name]: isCheckbox
            ? target.checked
            : (name === 'persons' || name === 'kcal')
                ? Number(value)
                : value,
    });
  };
  
  const handleSelectChange = (name: keyof PlanSettings, value: string | number) => {
      onSettingsChange({ ...settings, [name]: value });
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
  
  const openRecipeSelector = (mealType: MealCategory) => {
      setSelectorMealType(mealType);
      setIsSelectorOpen(true);
  };
  
  const handleRecipeSelect = (recipe: Recipe) => {
      const key = `selected${selectorMealType.charAt(0).toUpperCase() + selectorMealType.slice(1)}RecipeId` as keyof PlanSettings;
      const textKey = `custom${selectorMealType.charAt(0).toUpperCase() + selectorMealType.slice(1)}Text` as keyof PlanSettings;
      onSettingsChange({ ...settings, [key]: recipe.id, [textKey]: '' });
      setIsSelectorOpen(false);
  };

  const showBreakfastOption = (settings.includedMeals || []).includes('breakfast');
  const showSnackOption = (settings.includedMeals || []).includes('snack');
  const showCoffeeOption = (settings.includedMeals || []).includes('coffee');
  const showMainMealFocus = (settings.includedMeals || []).includes('lunch') && (settings.includedMeals || []).includes('dinner');

  const inputStyles = "mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm";
  const stepButtonStyles = "px-4 bg-slate-200 text-slate-700 font-bold border border-slate-300 hover:bg-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:z-10 transition-colors";

  const RoutineMealSettings: React.FC<{ mealType: MealCategory, label: string }> = ({ mealType, label }) => {
    const useSameKey = `useSame${mealType.charAt(0).toUpperCase() + mealType.slice(1)}` as keyof PlanSettings;
    const customTextKey = `custom${mealType.charAt(0).toUpperCase() + mealType.slice(1)}Text` as keyof PlanSettings;
    const selectedIdKey = `selected${mealType.charAt(0).toUpperCase() + mealType.slice(1)}RecipeId` as keyof PlanSettings;
    
    const selectedRecipe = allRecipes.find(r => r.id === settings[selectedIdKey]);

    return (
        <div className="bg-slate-50 p-4 rounded-lg">
            <label htmlFor={String(useSameKey)} className="flex items-center space-x-2 cursor-pointer font-medium">
                <input type="checkbox" name={String(useSameKey)} id={String(useSameKey)} checked={!!settings[useSameKey]} onChange={handleChange} className="h-4 w-4 rounded" />
                <span>Jeden Tag {label}</span>
            </label>
            {settings[useSameKey] && (
                <div className="mt-3 space-y-3">
                    {selectedRecipe ? (
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-md">
                           <p className="text-xs text-emerald-800">Ausgewähltes Rezept:</p>
                           <p className="font-semibold text-emerald-900">{selectedRecipe.title}</p>
                           <button onClick={() => onSettingsChange({ ...settings, [selectedIdKey]: null })} className="text-xs text-red-600 hover:underline mt-1">Auswahl aufheben</button>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor={String(customTextKey)} className="block text-xs font-medium text-slate-600 mb-1">Beschreiben Sie Ihr(en) {label}:</label>
                            <textarea name={String(customTextKey)} id={String(customTextKey)} value={settings[customTextKey] as string || ''} onChange={handleChange} rows={2} placeholder={`z.B. Protein-Shake mit Haferflocken...`} className={inputStyles}></textarea>
                        </div>
                    )}
                    <div className="text-center text-sm text-slate-500">oder</div>
                    <button type="button" onClick={() => openRecipeSelector(mealType)} className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-100 transition-colors">Rezept aus Archiv auswählen</button>
                </div>
            )}
        </div>
    );
  };

  return (
    <>
    <RecipeSelectorModal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} recipes={allRecipes} mealCategory={selectorMealType} onSelect={handleRecipeSelect} />
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
            <label className="block text-sm font-medium text-slate-700">Ernährungsweise</label>
            <CustomSelect
              value={settings.dietaryPreference}
              onChange={(value) => handleSelectChange('dietaryPreference', value)}
              options={[
                { value: 'omnivore', label: 'Alles' },
                { value: 'vegetarian', label: 'Vegetarisch' },
                { value: 'vegan', label: 'Vegan' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Koch-Niveau</label>
             <CustomSelect
              value={settings.dishComplexity}
              onChange={(value) => handleSelectChange('dishComplexity', value)}
              options={[
                { value: 'simple', label: 'Einfache Gerichte' },
                { value: 'advanced', label: 'Fortgeschrittene Gerichte' },
                { value: 'fancy', label: 'Pfiffige Gerichte' },
              ]}
            />
          </div>
        </div>
        
        {/* Column 3 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Diät-Typ</label>
             <CustomSelect
              value={settings.dietType}
              onChange={(value) => handleSelectChange('dietType', value)}
              options={[
                 { value: 'balanced', label: 'Ausgewogen' },
                 { value: 'low-carb', label: 'Low-Carb' },
                 { value: 'keto', label: 'Ketogen' },
                 { value: 'high-protein', label: 'High-Protein' },
                 { value: 'mediterranean', label: 'Mediterran' },
              ]}
            />
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

      {(showBreakfastOption || showSnackOption || showCoffeeOption) && (
          <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700">Tägliche Routinen (Optional)</label>
              <p className="text-xs text-slate-500 mt-1 mb-2">Hier können Sie angeben, ob Sie jeden Tag das gleiche Frühstück, den gleichen Snack etc. essen möchten. Wählen Sie ein bestehendes Rezept aus oder beschreiben Sie es für die KI.</p>
              <div className="space-y-4">
                  {showBreakfastOption && <RoutineMealSettings mealType="breakfast" label="das gleiche Frühstück" />}
                  {showSnackOption && <RoutineMealSettings mealType="snack" label="den gleichen Snack" />}
                  {showCoffeeOption && <RoutineMealSettings mealType="coffee" label="den gleichen Kaffee & Kuchen" />}
              </div>
          </div>
      )}

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
       <div>
        <label htmlFor="creativeInspiration" className="block text-sm font-medium text-slate-700">Küchenstil / Inspiration (Optional)</label>
        <p className="text-xs text-slate-500 mt-1">Gib der KI eine kreative Richtung, z.B. "Italienische Woche", "Leichte asiatische Gerichte" oder "Fokus auf Kürbis".</p>
        <textarea name="creativeInspiration" id="creativeInspiration" value={settings.creativeInspiration || ''} onChange={handleChange} rows={2} placeholder="z.B. Mediterrane Küche, schnelle Feierabendgerichte..." className={inputStyles}></textarea>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isLoading} className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed">
          {isLoading ? 'Generiere...' : 'Plan generieren'}
        </button>
      </div>
    </form>
    </>
  );
};

export default SettingsPanel;
