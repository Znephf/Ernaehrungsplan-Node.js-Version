import React, { useState, useMemo, DragEvent, useEffect } from 'react';
import type { Recipe, Diet, DietType, DishComplexity, MealCategory } from '../types';
import { MealCategoryLabels, MEAL_ORDER } from '../types';
import * as apiService from '../services/apiService';
import { LoadingSpinnerIcon, CloseIcon } from './IconComponents';

const useMediaQuery = (query: string): boolean => {
    const isClient = typeof window === 'object';
    const [matches, setMatches] = useState(isClient ? window.matchMedia(query).matches : false);
    useEffect(() => {
        if (!isClient) return;
        const mediaQueryList = window.matchMedia(query);
        const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
        mediaQueryList.addEventListener('change', listener);
        setMatches(mediaQueryList.matches);
        return () => mediaQueryList.removeEventListener('change', listener);
    }, [query, isClient]);
    return matches;
};

interface PlannerComponentProps {
  onPlanSaved: () => void;
}

const dietPreferenceLabels: Record<Diet, string> = { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan' };
const dietTypeLabels: Record<DietType, string> = { balanced: 'Ausgewogen', 'low-carb': 'Low-Carb', keto: 'Ketogen', 'high-protein': 'High-Protein', mediterranean: 'Mediterran' };
const dishComplexityLabels: Record<DishComplexity, string> = { simple: 'Einfach', advanced: 'Fortgeschritten', fancy: 'Pfiffig' };
const FilterToggleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${ isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300' }`}>{label}</button>
);

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

type WeeklySlots = { [day: string]: { recipe: Recipe; mealType: MealCategory; uniqueId: string }[] };

const PlannerComponent: React.FC<PlannerComponentProps> = ({ onPlanSaved }) => {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    
    useEffect(() => {
        apiService.getAllRecipes()
            .then(setAllRecipes)
            .catch(err => console.error("Could not fetch recipes for planner:", err));
    }, []);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMealCategories, setSelectedMealCategories] = useState<Set<MealCategory>>(new Set());
    const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
    const [selectedDietTypes, setSelectedDietTypes] = useState<Set<DietType>>(new Set());
    const [selectedComplexities, setSelectedComplexities] = useState<Set<DishComplexity>>(new Set());
    const [filterGlutenFree, setFilterGlutenFree] = useState(false);
    const [filterLactoseFree, setFilterLactoseFree] = useState(false);

    const [weeklySlots, setWeeklySlots] = useState<WeeklySlots>(WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {}));
    const [planName, setPlanName] = useState('');
    const [persons, setPersons] = useState(2);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDay, setModalDay] = useState<string | null>(null);
    const [modalMealType, setModalMealType] = useState<MealCategory | null>(null);
    const [addingMealToDay, setAddingMealToDay] = useState<string | null>(null);
    
    const [visibleMeals, setVisibleMeals] = useState<Set<MealCategory>>(new Set(MEAL_ORDER));

    const handleMealVisibilityChange = (mealType: MealCategory, checked: boolean) => {
        const newVisibleMeals = new Set(visibleMeals);
        if (checked) {
            newVisibleMeals.add(mealType);
        } else {
            // FIX: Explicitly cast `daySlots` to `any[]` to resolve TypeScript error where it's inferred as `unknown`.
            const hasRecipesInSlots = Object.values(weeklySlots).some((daySlots: any[]) => 
                daySlots.some(slot => slot.mealType === mealType)
            );
            if (hasRecipesInSlots && !window.confirm(`Möchten Sie wirklich alle "${MealCategoryLabels[mealType]}"-Gerichte aus dem Plan entfernen?`)) {
                return; // User cancelled
            }
            // Remove recipes from weeklySlots
            const newWeeklySlots = { ...weeklySlots };
            for (const day in newWeeklySlots) {
                newWeeklySlots[day] = newWeeklySlots[day].filter(slot => slot.mealType !== mealType);
            }
            setWeeklySlots(newWeeklySlots);
            newVisibleMeals.delete(mealType);
        }
        setVisibleMeals(newVisibleMeals);
    };

    const sortedVisibleMeals = useMemo(() => MEAL_ORDER.filter(m => visibleMeals.has(m)), [visibleMeals]);


    const filteredRecipes = useMemo(() => {
        return allRecipes.filter(recipe => {
            const matchesSearch = !searchTerm.trim() || recipe.title.toLowerCase().includes(searchTerm.toLowerCase().trim());
            const matchesCategory = selectedMealCategories.size === 0 || selectedMealCategories.has(recipe.category);
            const matchesPreference = selectedPreferences.size === 0 || (recipe.dietaryPreference && selectedPreferences.has(recipe.dietaryPreference));
            const matchesDietType = selectedDietTypes.size === 0 || (recipe.dietType && selectedDietTypes.has(recipe.dietType));
            const matchesComplexity = selectedComplexities.size === 0 || (recipe.dishComplexity && selectedComplexities.has(recipe.dishComplexity));
            const matchesGlutenFree = !filterGlutenFree || !!recipe.isGlutenFree;
            const matchesLactoseFree = !filterLactoseFree || !!recipe.isLactoseFree;
            
            return matchesSearch && matchesCategory && matchesPreference && matchesDietType && matchesComplexity && matchesGlutenFree && matchesLactoseFree;
        });
    }, [allRecipes, searchTerm, selectedMealCategories, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree]);
    
    const handleFilterToggle = <T extends string>(value: T, currentFilters: Set<T>, setFilters: React.Dispatch<React.SetStateAction<Set<T>>>) => {
        const newFilters = new Set(currentFilters);
        newFilters.has(value) ? newFilters.delete(value) : newFilters.add(value);
        setFilters(newFilters);
    };

    const handleSavePlan = async () => {
        // FIX: Explicitly cast `day` to `any[]` to resolve TypeScript error where it's inferred as `unknown`.
        if (!planName.trim() || Object.values(weeklySlots).every((day: any[]) => day.length === 0)) {
            setError("Bitte geben Sie einen Plannamen an und fügen Sie mindestens ein Rezept hinzu.");
            return;
        }
        setIsSaving(true);
        setError(null);
        
        try {
            await apiService.saveCustomPlan({ name: planName, persons, mealsByDay: weeklySlots });
            alert("Ihr individueller Plan wurde erfolgreich gespeichert!");
            onPlanSaved();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const removeRecipeFromSlot = (day: string, uniqueId: string) => {
        setWeeklySlots(prev => ({
            ...prev,
            [day]: prev[day].filter(slot => slot.uniqueId !== uniqueId)
        }));
    };
    
    const handleDragStart = (e: DragEvent<HTMLDivElement>, recipe: Recipe) => { e.dataTransfer.setData('application/json', JSON.stringify(recipe)); e.dataTransfer.effectAllowed = 'copy'; };
    
    const handleDrop = (e: DragEvent<HTMLDivElement>, day: string, mealType: MealCategory) => {
        e.preventDefault();
        e.stopPropagation();
        const recipeData = e.dataTransfer.getData('application/json');
        if (recipeData) {
            const recipe = JSON.parse(recipeData) as Recipe;
            // Nur droppen, wenn die Kategorie passt
            if (recipe.category === mealType) {
                 setWeeklySlots(prev => ({
                    ...prev,
                    [day]: [...prev[day], { recipe, mealType, uniqueId: `${day}-${Date.now()}` }]
                }));
            }
        }
        e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400');
    };
    
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('bg-emerald-100', 'border-emerald-400'); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400'); };
    
    const openRecipeSelector = (day: string, mealType: MealCategory) => { 
        setModalDay(day); 
        setModalMealType(mealType);
        setIsModalOpen(true); 
        setAddingMealToDay(null);
    };

    const handleSelectRecipeForDay = (recipe: Recipe) => {
        if (modalDay && modalMealType) {
            setWeeklySlots(prev => ({
                ...prev,
                [modalDay]: [...prev[modalDay], { recipe, mealType: modalMealType, uniqueId: `${modalDay}-${Date.now()}` }]
            }));
        }
        setIsModalOpen(false);
        setModalDay(null);
        setModalMealType(null);
    };

    const SavePlanUI = (
         <div className="bg-white p-6 rounded-lg shadow-lg">
             <h3 className="text-xl font-bold text-slate-700 mb-4">Plan speichern</h3>
             {error && <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">{error}</div>}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2"><label htmlFor="planName" className="block text-sm font-medium">Name des Plans</label><input type="text" id="planName" value={planName} onChange={e => setPlanName(e.target.value)} placeholder="z.B. Meine vegetarische Lieblingswoche" className="mt-1 block w-full rounded-md border-slate-300" /></div>
                <div><label htmlFor="persons" className="block text-sm font-medium">Anzahl Personen</label><input type="number" id="persons" value={persons} onChange={e => setPersons(Math.max(1, parseInt(e.target.value,10)||1))} min="1" className="mt-1 block w-full rounded-md border-slate-300" /></div>
             </div>
             <div className="flex justify-end mt-4"><button onClick={handleSavePlan} disabled={isSaving} className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400">{isSaving && <LoadingSpinnerIcon />}{isSaving ? 'Speichere...' : 'Plan speichern'}</button></div>
        </div>
    );
    
    const filterControls = (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 mb-4">Gerichte-Bibliothek</h2>
        <input type="text" placeholder="Suche..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-md border-slate-300 mb-4" />
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Mahlzeit:</span>{(Object.keys(MealCategoryLabels) as MealCategory[]).map(key => <FilterToggleButton key={key} label={MealCategoryLabels[key]} isSelected={selectedMealCategories.has(key)} onClick={() => handleFilterToggle(key, selectedMealCategories, setSelectedMealCategories)} />)}</div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährung:</span>{(Object.keys(dietPreferenceLabels) as Diet[]).map(key => <FilterToggleButton key={key} label={dietPreferenceLabels[key]} isSelected={selectedPreferences.has(key)} onClick={() => handleFilterToggle(key,selectedPreferences,setSelectedPreferences)} />)}</div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Diät-Typ:</span>{(Object.keys(dietTypeLabels) as DietType[]).map(key => <FilterToggleButton key={key} label={dietTypeLabels[key]} isSelected={selectedDietTypes.has(key)} onClick={() => handleFilterToggle(key,selectedDietTypes,setSelectedDietTypes)} />)}</div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Niveau:</span>{(Object.keys(dishComplexityLabels) as DishComplexity[]).map(key => <FilterToggleButton key={key} label={dishComplexityLabels[key]} isSelected={selectedComplexities.has(key)} onClick={() => handleFilterToggle(key,selectedComplexities,setSelectedComplexities)} />)}</div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Optionen:</span>
                <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                    <input type="checkbox" checked={filterGlutenFree} onChange={e => setFilterGlutenFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" />
                    <span>Nur Glutenfrei</span>
                </label>
                 <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                    <input type="checkbox" checked={filterLactoseFree} onChange={e => setFilterLactoseFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" />
                    <span>Nur Laktosefrei</span>
                </label>
            </div>
        </div>
      </div>
    );

    const recipeList = (onSelect: (recipe: Recipe) => void, mealTypeFilter?: MealCategory | null) => (
      <div className="space-y-3">
        {filteredRecipes.length > 0 ? filteredRecipes
            .filter(recipe => !mealTypeFilter || recipe.category === mealTypeFilter)
            .map(recipe => (
          <div key={recipe.id} draggable={isDesktop} onDragStart={e => handleDragStart(e, recipe)} onClick={() => !isDesktop && onSelect(recipe)} className="bg-white p-3 rounded-lg shadow hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-grab active:cursor-grabbing flex items-center gap-4">
            {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}
            <div className="flex-grow"><p className="font-semibold text-slate-700">{recipe.title}</p><p className="text-xs text-slate-400">{MealCategoryLabels[recipe.category]} &bull; {recipe.totalCalories} kcal</p></div>
          </div>
        )) : <div className="text-center py-8 text-slate-500">Keine Gerichte für diese Filter gefunden.</div>}
      </div>
    );

    const mealDropZone = (day: string, mealType: MealCategory) => {
        const mealsInSlot = weeklySlots[day].filter(slot => slot.mealType === mealType);
        return (
            <div 
                onDrop={e => handleDrop(e, day, mealType)} 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave} 
                className="border-2 border-dashed border-slate-300 rounded-lg p-3 min-h-[100px] transition-colors space-y-2"
            >
                <h4 className="font-bold text-slate-500 text-sm">{MealCategoryLabels[mealType]}</h4>
                {mealsInSlot.length > 0 ? mealsInSlot.map(slot => (
                    <div key={slot.uniqueId} className="bg-emerald-50 p-2 rounded-md shadow-sm relative"><p className="font-semibold text-emerald-800 text-sm">{slot.recipe.title}</p><p className="text-xs text-emerald-600">{slot.recipe.totalCalories} kcal</p><button onClick={() => removeRecipeFromSlot(day, slot.uniqueId)} className="absolute top-1 right-1 h-5 w-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs hover:bg-red-300">&times;</button></div>
                )) : <p className="text-xs text-slate-400 text-center pt-4">Rezept hierher ziehen</p>}
            </div>
        );
    };

    return (
        <div>
            {isDesktop ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    {/* ===== LEFT COLUMN: Recipe List ===== */}
                    <div className="lg:col-span-2 space-y-6 sticky top-24">
                        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[calc(100vh-8rem)]">
                           <div className="p-6 border-b flex-shrink-0">
                               <h2 className="text-2xl font-bold text-slate-700">Verfügbare Gerichte</h2>
                           </div>
                           <div className="overflow-y-auto p-6 flex-grow">
                               {recipeList(() => {})}
                           </div>
                        </div>
                    </div>

                    {/* ===== RIGHT COLUMN: Filters & Plan ===== */}
                    <div className="lg:col-span-3 space-y-6">
                        {filterControls}
                        <div className="bg-white p-6 rounded-lg shadow-lg">
                          <h2 className="text-2xl font-bold text-slate-700 mb-4">Mein Wochenplan</h2>
                          <div className="bg-slate-50 p-4 rounded-md mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Mahlzeiten-Slots auswählen</label>
                            <div className="flex flex-wrap gap-4">
                              {(Object.keys(MealCategoryLabels) as MealCategory[]).map(mealType => (
                                <label key={mealType} className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700">
                                    <input type="checkbox" checked={visibleMeals.has(mealType)} onChange={(e) => handleMealVisibilityChange(mealType, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                                    <span>{MealCategoryLabels[mealType]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-6">
                            {WEEKDAYS.map(day => (
                                <div key={day} className="border border-slate-200 p-4 rounded-lg">
                                    <h3 className="font-bold text-slate-600 mb-3 text-lg">{day}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {sortedVisibleMeals.map(mealType => mealDropZone(day, mealType))}
                                    </div>
                                </div>
                            ))}
                          </div>
                        </div>
                        {SavePlanUI}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                      <h2 className="text-2xl font-bold text-slate-700 mb-4">Mein Wochenplan</h2>
                       <div className="bg-slate-50 p-4 rounded-md mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Mahlzeiten-Slots auswählen</label>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {(Object.keys(MealCategoryLabels) as MealCategory[]).map(mealType => (
                                <label key={mealType} className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700">
                                    <input type="checkbox" checked={visibleMeals.has(mealType)} onChange={(e) => handleMealVisibilityChange(mealType, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                                    <span>{MealCategoryLabels[mealType]}</span>
                                </label>
                              ))}
                            </div>
                        </div>
                      <div className="space-y-4">
                        {WEEKDAYS.map(day => (
                          <div key={day} className="border border-slate-200 rounded-lg p-4">
                              <h3 className="font-bold text-slate-600 mb-2">{day}</h3>
                              <div className="space-y-2">
                                {weeklySlots[day].length > 0 ? weeklySlots[day].sort((a,b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)).map(slot => (
                                  <div key={slot.uniqueId} className="bg-emerald-50 p-2 rounded-md relative"><p className="font-semibold text-emerald-800 text-sm">{slot.recipe.title}</p><p className="text-xs text-emerald-600">{MealCategoryLabels[slot.mealType]} &bull; {slot.recipe.totalCalories} kcal</p><button onClick={() => removeRecipeFromSlot(day, slot.uniqueId)} className="absolute top-1 right-1 h-6 w-6 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-sm">&times;</button></div>
                                )) : <p className="text-center text-xs text-slate-400 py-2">Noch keine Mahlzeiten für diesen Tag.</p>}
                                <div className="relative">
                                    <button onClick={() => setAddingMealToDay(addingMealToDay === day ? null : day)} className="w-full text-center text-sm text-emerald-600 font-semibold p-2 bg-emerald-50 hover:bg-emerald-100 rounded-md">+ Mahlzeit hinzufügen</button>
                                    {addingMealToDay === day && (
                                        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border rounded-md shadow-lg z-10">
                                            <p className="text-xs font-semibold text-slate-600 mb-2 px-1">Welche Mahlzeit?</p>
                                            <div className="flex flex-col items-start gap-1">
                                                {sortedVisibleMeals.map(mealType => (
                                                    <button key={mealType} onClick={() => openRecipeSelector(day, mealType)} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 rounded hover:bg-slate-100">{MealCategoryLabels[mealType]}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                              </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {SavePlanUI}
                </div>
            )}
            
            {!isDesktop && (
                <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex flex-col p-4 ${isModalOpen ? 'block' : 'hidden'}`}>
                    <div className="bg-slate-100 rounded-lg shadow-xl flex flex-col h-full overflow-hidden">
                        <header className="p-4 border-b bg-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">
                                {modalMealType && MealCategoryLabels[modalMealType]} für {modalDay}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button>
                        </header>
                        <div className="flex-grow overflow-y-auto p-4 space-y-4">
                            {filterControls}
                            <div className="pt-4">{recipeList(handleSelectRecipeForDay, modalMealType)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlannerComponent;