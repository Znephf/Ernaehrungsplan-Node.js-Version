import React, { useState, useMemo, useCallback, DragEvent } from 'react';
import type { ArchiveEntry, Recipe, Diet, DietType, DishComplexity, WeeklyPlan, Recipes } from '../types';
import * as apiService from '../services/apiService';
import { LoadingSpinnerIcon } from './IconComponents';

interface PlannerComponentProps {
  archive: ArchiveEntry[];
  onPlanSaved: () => void;
}

// Helper to get a unique recipe identifier
const getRecipeId = (recipe: Recipe, planId: number) => `${planId}-${recipe.title}`;

// Helper to get unique recipes from the entire archive
const getUniqueRecipes = (archive: ArchiveEntry[]): (Recipe & { sourcePlanId: number; sourcePlanSettings: any })[] => {
    const uniqueRecipes = new Map<string, Recipe & { sourcePlanId: number; sourcePlanSettings: any }>();
    archive.forEach(plan => {
        plan.recipes.forEach(recipe => {
            const recipeId = getRecipeId(recipe, plan.id);
            if (!uniqueRecipes.has(recipe.title)) { // Use title to deduplicate across plans
                uniqueRecipes.set(recipe.title, { ...recipe, sourcePlanId: plan.id, sourcePlanSettings: { dietaryPreference: plan.dietaryPreference, dietType: plan.dietType, dishComplexity: plan.dishComplexity, isGlutenFree: plan.isGlutenFree, isLactoseFree: plan.isLactoseFree } });
            }
        });
    });
    return Array.from(uniqueRecipes.values());
};

const dietPreferenceLabels: Record<Diet, string> = { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan' };
const dietTypeLabels: Record<DietType, string> = { balanced: 'Ausgewogen', 'low-carb': 'Low-Carb', keto: 'Ketogen', 'high-protein': 'High-Protein', mediterranean: 'Mediterran' };
const dishComplexityLabels: Record<DishComplexity, string> = { simple: 'Einfach', advanced: 'Fortgeschritten', fancy: 'Pfiffig' };

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const PlannerComponent: React.FC<PlannerComponentProps> = ({ archive, onPlanSaved }) => {
    const allRecipes = useMemo(() => getUniqueRecipes(archive), [archive]);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
    const [selectedDietTypes, setSelectedDietTypes] = useState<Set<DietType>>(new Set());
    const [selectedComplexities, setSelectedComplexities] = useState<Set<DishComplexity>>(new Set());
    const [filterGlutenFree, setFilterGlutenFree] = useState(false);
    const [filterLactoseFree, setFilterLactoseFree] = useState(false);

    // Planner states
    const [weeklySlots, setWeeklySlots] = useState<(Recipe & { uniqueId: string }) | null[]>(Array(7).fill(null));
    const [planName, setPlanName] = useState('');
    const [persons, setPersons] = useState(2);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filteredRecipes = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        return allRecipes.filter(recipe => {
            const settings = recipe.sourcePlanSettings;
            const matchesSearch = !lowercasedTerm || recipe.title.toLowerCase().includes(lowercasedTerm);
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

    const handleDragStart = (e: DragEvent<HTMLDivElement>, recipe: Recipe) => {
        e.dataTransfer.setData('application/json', JSON.stringify(recipe));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, dayIndex: number) => {
        e.preventDefault();
        const recipeData = e.dataTransfer.getData('application/json');
        if (recipeData) {
            const recipe = JSON.parse(recipeData);
            const newSlots = [...weeklySlots];
            newSlots[dayIndex] = { ...recipe, uniqueId: `${dayIndex}-${Date.now()}` };
            setWeeklySlots(newSlots);
        }
        e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400');
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.classList.add('bg-emerald-100', 'border-emerald-400');
    };
    
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-emerald-100', 'border-emerald-400');
    };
    
    const removeRecipeFromSlot = (dayIndex: number) => {
        const newSlots = [...weeklySlots];
        newSlots[dayIndex] = null;
        setWeeklySlots(newSlots);
    };

    const handleSavePlan = async () => {
        if (!planName.trim() || weeklySlots.every(slot => slot === null)) {
            setError("Bitte geben Sie einen Plannamen an und fügen Sie mindestens ein Rezept hinzu.");
            return;
        }
        setIsSaving(true);
        setError(null);
        
        const filledSlots = weeklySlots.map((recipe, index) => ({ recipe, day: WEEKDAYS[index] })).filter(slot => slot.recipe !== null);

        const customPlanPayload = {
            name: planName,
            persons: persons,
            dinners: filledSlots.map(slot => ({ day: slot.day, recipe: slot.recipe! }))
        };

        try {
            await apiService.saveCustomPlan(customPlanPayload);
            alert("Ihr individueller Plan wurde erfolgreich gespeichert!");
            onPlanSaved();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };


    const FilterToggleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
        <button onClick={onClick} className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${ isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300' }`}>{label}</button>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Recipe Library & Filters */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 mb-4">Gerichte-Bibliothek</h2>
                    <input type="text" placeholder="Suche in Gerichten..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm mb-4" />
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährungsweise:</span>{Object.entries(dietPreferenceLabels).map(([key, label]) => (<FilterToggleButton key={key} label={label} isSelected={selectedPreferences.has(key as Diet)} onClick={() => handleFilterToggle(key as Diet, selectedPreferences, setSelectedPreferences)} />))}</div>
                        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Diät-Typ:</span>{Object.entries(dietTypeLabels).map(([key, label]) => (<FilterToggleButton key={key} label={label} isSelected={selectedDietTypes.has(key as DietType)} onClick={() => handleFilterToggle(key as DietType, selectedDietTypes, setSelectedDietTypes)} />))}</div>
                        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Koch-Niveau:</span>{Object.entries(dishComplexityLabels).map(([key, label]) => (<FilterToggleButton key={key} label={label} isSelected={selectedComplexities.has(key as DishComplexity)} onClick={() => handleFilterToggle(key as DishComplexity, selectedComplexities, setSelectedComplexities)} />))}</div>
                        <div className="flex flex-wrap items-center gap-2 pt-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Optionen:</span><label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm"><input type="checkbox" checked={filterGlutenFree} onChange={(e) => setFilterGlutenFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" /><span>Nur Glutenfrei</span></label><label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm"><input type="checkbox" checked={filterLactoseFree} onChange={(e) => setFilterLactoseFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" /><span>Nur Laktosefrei</span></label></div>
                    </div>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {filteredRecipes.map((recipe, index) => (
                        <div key={`${recipe.sourcePlanId}-${index}`} draggable onDragStart={(e) => handleDragStart(e, recipe)} className="bg-white p-3 rounded-md shadow hover:shadow-md cursor-grab active:cursor-grabbing border border-slate-200">
                            <p className="font-semibold text-slate-700">{recipe.title}</p>
                            <p className="text-xs text-slate-400">{recipe.totalCalories} kcal &bull; {dietPreferenceLabels[recipe.sourcePlanSettings.dietaryPreference]}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Planner & Save */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 mb-4">Mein Wochenplan</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {WEEKDAYS.map((day, index) => (
                            <div key={day} onDrop={(e) => handleDrop(e, index)} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className="border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[100px] transition-colors">
                                <h3 className="font-bold text-slate-600 mb-2">{day}</h3>
                                {weeklySlots[index] ? (
                                    <div className="bg-emerald-50 p-2 rounded-md shadow-sm relative">
                                        <p className="font-semibold text-emerald-800 text-sm">{weeklySlots[index]!.title}</p>
                                        <p className="text-xs text-emerald-600">{weeklySlots[index]!.totalCalories} kcal</p>
                                        <button onClick={() => removeRecipeFromSlot(index)} className="absolute top-1 right-1 h-5 w-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-300">&times;</button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 text-center pt-4">Rezept hierher ziehen</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                     <h3 className="text-xl font-bold text-slate-700 mb-4">Plan speichern</h3>
                     {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert"><strong className="font-bold">Fehler!</strong><span className="block sm:inline ml-2">{error}</span></div>}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                             <label htmlFor="planName" className="block text-sm font-medium text-slate-700">Name des Plans</label>
                             <input type="text" id="planName" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="z.B. Meine vegetarische Lieblingswoche" className="mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                        </div>
                        <div>
                             <label htmlFor="persons" className="block text-sm font-medium text-slate-700">Anzahl Personen</label>
                             <input type="number" id="persons" value={persons} onChange={(e) => setPersons(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" className="mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                        </div>
                     </div>
                     <div className="flex justify-end mt-4">
                         <button onClick={handleSavePlan} disabled={isSaving} className="inline-flex justify-center items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                            {isSaving && <LoadingSpinnerIcon />}
                            {isSaving ? 'Speichere...' : 'Plan im Archiv speichern'}
                         </button>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default PlannerComponent;
