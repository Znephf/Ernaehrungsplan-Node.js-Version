import React, { useState, useMemo, DragEvent, useEffect } from 'react';
import type { ArchiveEntry, Recipe, Diet, DietType, DishComplexity, MealCategory } from '../types';
import { MealCategoryLabels } from '../types';
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
  archive: ArchiveEntry[];
  onPlanSaved: () => void;
}

type PlannerRecipe = Recipe & { 
    sourcePlanSettings: any;
};

const getUniqueRecipes = (archive: ArchiveEntry[]): PlannerRecipe[] => {
    const uniqueRecipes = new Map<number, PlannerRecipe>();
    archive.forEach(plan => {
        (plan.recipes || []).forEach(recipe => {
            if (!uniqueRecipes.has(recipe.id)) {
                uniqueRecipes.set(recipe.id, { 
                    ...recipe, 
                    sourcePlanSettings: { ...plan.settings }
                });
            }
        });
    });
    return Array.from(uniqueRecipes.values());
};

const dietPreferenceLabels: Record<Diet, string> = { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan' };
const dietTypeLabels: Record<DietType, string> = { balanced: 'Ausgewogen', 'low-carb': 'Low-Carb', keto: 'Ketogen', 'high-protein': 'High-Protein', mediterranean: 'Mediterran' };
const dishComplexityLabels: Record<DishComplexity, string> = { simple: 'Einfach', advanced: 'Fortgeschritten', fancy: 'Pfiffig' };
const FilterToggleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${ isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300' }`}>{label}</button>
);

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

type WeeklySlots = { [day: string]: { recipe: PlannerRecipe; mealType: MealCategory; uniqueId: string }[] };

const PlannerComponent: React.FC<PlannerComponentProps> = ({ archive, onPlanSaved }) => {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const allRecipes = useMemo(() => getUniqueRecipes(archive), [archive]);
    
    const [searchTerm, setSearchTerm] = useState('');
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

    const filteredRecipes = useMemo(() => {
        return allRecipes.filter(recipe => {
            const settings = recipe.sourcePlanSettings;
            if (!settings) return false;
            const matchesSearch = !searchTerm.trim() || recipe.title.toLowerCase().includes(searchTerm.toLowerCase().trim());
            const matchesPreference = selectedPreferences.size === 0 || selectedPreferences.has(settings.dietaryPreference);
            const matchesDietType = selectedDietTypes.size === 0 || selectedDietTypes.has(settings.dietType);
            const matchesComplexity = selectedComplexities.size === 0 || selectedComplexities.has(settings.dishComplexity);
            const matchesGlutenFree = !filterGlutenFree || settings.isGlutenFree;
            const matchesLactoseFree = !filterLactoseFree || settings.isLactoseFree;
            return matchesSearch && matchesPreference && matchesDietType && matchesComplexity && matchesGlutenFree && matchesLactoseFree;
        });
    }, [allRecipes, searchTerm, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree]);
    
    const handleFilterToggle = <T extends string>(value: T, currentFilters: Set<T>, setFilters: React.Dispatch<React.SetStateAction<Set<T>>>) => {
        const newFilters = new Set(currentFilters);
        newFilters.has(value) ? newFilters.delete(value) : newFilters.add(value);
        setFilters(newFilters);
    };

    const handleSavePlan = async () => {
        if (!planName.trim() || Object.values(weeklySlots).every(day => day.length === 0)) {
            setError("Bitte geben Sie einen Plannamen an und fügen Sie mindestens ein Rezept hinzu.");
            return;
        }
        setIsSaving(true);
        setError(null);
        
        try {
            // Fix: Changed property name from `dinners` to `mealsByDay` to match API service expectation.
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
    
    const handleDragStart = (e: DragEvent<HTMLDivElement>, recipe: PlannerRecipe) => { e.dataTransfer.setData('application/json', JSON.stringify(recipe)); e.dataTransfer.effectAllowed = 'copy'; };
    const handleDrop = (e: DragEvent<HTMLDivElement>, day: string) => {
        e.preventDefault();
        const recipeData = e.dataTransfer.getData('application/json');
        if (recipeData) {
            const recipe = JSON.parse(recipeData) as PlannerRecipe;
            setWeeklySlots(prev => ({
                ...prev,
                [day]: [...prev[day], { recipe, mealType: recipe.category, uniqueId: `${day}-${Date.now()}` }]
            }));
        }
        e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400');
    };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('bg-emerald-100', 'border-emerald-400'); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400'); };
    
    const openRecipeSelector = (day: string) => { setModalDay(day); setIsModalOpen(true); };
    const handleSelectRecipeForDay = (recipe: PlannerRecipe) => {
        if (modalDay) {
            setWeeklySlots(prev => ({
                ...prev,
                [modalDay]: [...prev[modalDay], { recipe, mealType: recipe.category, uniqueId: `${modalDay}-${Date.now()}` }]
            }));
        }
        setIsModalOpen(false);
        setModalDay(null);
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
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Typ:</span>{Object.entries(dietPreferenceLabels).map(([k, l]) => <FilterToggleButton key={k} label={l} isSelected={selectedPreferences.has(k as Diet)} onClick={() => handleFilterToggle(k as Diet,selectedPreferences,setSelectedPreferences)} />)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Diät:</span>{Object.entries(dietTypeLabels).map(([k, l]) => <FilterToggleButton key={k} label={l} isSelected={selectedDietTypes.has(k as DietType)} onClick={() => handleFilterToggle(k as DietType,selectedDietTypes,setSelectedDietTypes)} />)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Niveau:</span>{Object.entries(dishComplexityLabels).map(([k, l]) => <FilterToggleButton key={k} label={l} isSelected={selectedComplexities.has(k as DishComplexity)} onClick={() => handleFilterToggle(k as DishComplexity,selectedComplexities,setSelectedComplexities)} />)}</div>
          <div className="flex flex-wrap items-center gap-2 pt-2"><label className="flex items-center"><input type="checkbox" checked={filterGlutenFree} onChange={e => setFilterGlutenFree(e.target.checked)} className="mr-2 rounded" /> Glutenfrei</label><label className="flex items-center"><input type="checkbox" checked={filterLactoseFree} onChange={e => setFilterLactoseFree(e.target.checked)} className="mr-2 rounded" /> Laktosefrei</label></div>
        </div>
      </div>
    );

    const recipeList = (onSelect: (recipe: PlannerRecipe) => void) => (
      <div className="space-y-3">
        {filteredRecipes.length > 0 ? filteredRecipes.map(recipe => (
          <div key={recipe.id} draggable={isDesktop} onDragStart={e => handleDragStart(e, recipe)} onClick={() => !isDesktop && onSelect(recipe)} className="bg-white p-3 rounded-md shadow hover:shadow-md cursor-grab active:cursor-grabbing flex items-center gap-4">
            {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />}
            <div className="flex-grow"><p className="font-semibold text-slate-700">{recipe.title}</p><p className="text-xs text-slate-400">{MealCategoryLabels[recipe.category]} &bull; {recipe.totalCalories} kcal</p></div>
          </div>
        )) : <div className="text-center py-8 text-slate-500">Keine Gerichte gefunden.</div>}
      </div>
    );

    return (
        <div>
            {isDesktop ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">{filterControls}<div className="max-h-[60vh] overflow-y-auto pr-2">{recipeList(() => {})}</div></div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-lg">
                          <h2 className="text-2xl font-bold text-slate-700 mb-4">Mein Wochenplan</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {WEEKDAYS.map(day => (
                                <div key={day} onDrop={e => handleDrop(e, day)} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className="border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[120px] transition-colors space-y-2">
                                    <h3 className="font-bold text-slate-600">{day}</h3>
                                    {weeklySlots[day].length > 0 ? weeklySlots[day].map(slot => (
                                      <div key={slot.uniqueId} className="bg-emerald-50 p-2 rounded-md shadow-sm relative"><p className="font-semibold text-emerald-800 text-sm">{slot.recipe.title}</p><p className="text-xs text-emerald-600">{MealCategoryLabels[slot.mealType]} &bull; {slot.recipe.totalCalories} kcal</p><button onClick={() => removeRecipeFromSlot(day, slot.uniqueId)} className="absolute top-1 right-1 h-5 w-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs hover:bg-red-300">&times;</button></div>
                                    )) : <p className="text-sm text-slate-400 text-center pt-4">Rezept hierher ziehen</p>}
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
                      <div className="space-y-4">
                        {WEEKDAYS.map(day => (
                          <div key={day} className="border border-slate-200 rounded-lg p-4">
                              <h3 className="font-bold text-slate-600 mb-2">{day}</h3>
                              <div className="space-y-2">
                                {weeklySlots[day].map(slot => (
                                  <div key={slot.uniqueId} className="bg-emerald-50 p-2 rounded-md relative"><p className="font-semibold text-emerald-800 text-sm">{slot.recipe.title}</p><p className="text-xs text-emerald-600">{MealCategoryLabels[slot.mealType]} &bull; {slot.recipe.totalCalories} kcal</p><button onClick={() => removeRecipeFromSlot(day, slot.uniqueId)} className="absolute top-1 right-1 h-6 w-6 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-sm">&times;</button></div>
                                ))}
                                <button onClick={() => openRecipeSelector(day)} className="w-full text-center text-sm text-emerald-600 font-semibold p-2 bg-emerald-50 hover:bg-emerald-100 rounded-md">+ Mahlzeit hinzufügen</button>
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
                        <header className="p-4 border-b bg-white flex justify-between items-center"><h2 className="text-xl font-bold">Gericht für {modalDay}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100"><CloseIcon /></button></header>
                        <div className="flex-grow overflow-y-auto p-4 space-y-4">{filterControls}<div className="pt-4">{recipeList(handleSelectRecipeForDay)}</div></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlannerComponent;