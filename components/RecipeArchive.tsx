import React, { useState, useMemo } from 'react';
import type { ArchiveEntry, Recipe, Diet, DietType, DishComplexity, MealCategory } from '../types';
import { MealCategoryLabels } from '../types';
import { ProteinIcon, CarbsIcon, FatIcon, ChevronDownIcon } from './IconComponents';

interface RecipeArchiveProps {
  archive: ArchiveEntry[];
}

type ArchiveRecipe = Recipe & {
  sourcePlanSettings: Partial<ArchiveEntry['settings']>;
};

const getUniqueRecipesFromArchive = (archive: ArchiveEntry[]): ArchiveRecipe[] => {
  const uniqueRecipes = new Map<number, ArchiveRecipe>();
  archive.forEach(plan => {
    (plan.recipes || []).forEach(recipe => {
      if (!uniqueRecipes.has(recipe.id)) {
        uniqueRecipes.set(recipe.id, {
          ...recipe,
          sourcePlanSettings: plan.settings || {},
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

const RecipeCard: React.FC<{ recipe: ArchiveRecipe }> = ({ recipe }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const settings = recipe.sourcePlanSettings;

    return (
        <div className="bg-white rounded-lg shadow-lg flex flex-col overflow-hidden transition-shadow hover:shadow-xl">
            {recipe.image_url && (
                <div className="relative aspect-video bg-slate-200">
                    <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="p-4 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-emerald-700">{MealCategoryLabels[recipe.category]}</p>
                <h3 className="text-lg font-bold text-slate-800 mt-1 flex-grow">{recipe.title}</h3>
                <div className="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-3 items-center">
                    <span>{recipe.totalCalories} kcal</span>
                    {settings.dietaryPreference && <><span className="text-slate-300">&bull;</span><span className="capitalize">{settings.dietaryPreference === 'omnivore' ? 'Alles' : settings.dietaryPreference}</span></>}
                </div>

                <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2 text-sm bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors">
                    <span>{isExpanded ? 'Details ausblenden' : 'Details anzeigen'}</span>
                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 border-t border-slate-200 space-y-4">
                        {recipe.protein !== undefined && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 p-2 bg-slate-50 rounded-lg">
                                <span className="flex items-center gap-1.5 text-xs"><ProteinIcon /><div><span className="font-bold">{recipe.protein}g</span><span className="text-slate-500 text-xs block">Protein</span></div></span>
                                <span className="flex items-center gap-1.5 text-xs"><CarbsIcon /><div><span className="font-bold">{recipe.carbs}g</span><span className="text-slate-500 text-xs block">Kohlenh.</span></div></span>
                                <span className="flex items-center gap-1.5 text-xs"><FatIcon /><div><span className="font-bold">{recipe.fat}g</span><span className="text-slate-500 text-xs block">Fett</span></div></span>
                            </div>
                        )}
                        <div>
                            <h4 className="font-semibold text-slate-700 mb-1">Zutaten:</h4>
                            <ul className="space-y-1 list-disc list-inside text-slate-600 text-sm">{(recipe.ingredients || []).map((ing, i) => <li key={i}>{ing}</li>)}</ul>
                        </div>
                         <div>
                            <h4 className="font-semibold text-slate-700 mb-1">Anleitung:</h4>
                            <ol className="space-y-2 list-decimal list-inside text-slate-600 text-sm">{(recipe.instructions || []).map((step, i) => <li key={i}>{step}</li>)}</ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const RecipeArchiveComponent: React.FC<RecipeArchiveProps> = ({ archive }) => {
    const allRecipes = useMemo(() => getUniqueRecipesFromArchive(archive), [archive]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMealCategories, setSelectedMealCategories] = useState<Set<MealCategory>>(new Set());
    const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
    const [selectedDietTypes, setSelectedDietTypes] = useState<Set<DietType>>(new Set());
    const [selectedComplexities, setSelectedComplexities] = useState<Set<DishComplexity>>(new Set());
    const [filterGlutenFree, setFilterGlutenFree] = useState(false);
    const [filterLactoseFree, setFilterLactoseFree] = useState(false);

    const handleFilterToggle = <T extends string>(value: T, currentFilters: Set<T>, setFilters: React.Dispatch<React.SetStateAction<Set<T>>>) => {
        const newFilters = new Set(currentFilters);
        newFilters.has(value) ? newFilters.delete(value) : newFilters.add(value);
        setFilters(newFilters);
    };

    const filteredRecipes = useMemo(() => {
        return allRecipes.filter(recipe => {
            const settings = recipe.sourcePlanSettings;
            const matchesSearch = !searchTerm.trim() || recipe.title.toLowerCase().includes(searchTerm.toLowerCase().trim());
            const matchesCategory = selectedMealCategories.size === 0 || selectedMealCategories.has(recipe.category);
            const matchesPreference = selectedPreferences.size === 0 || (settings.dietaryPreference && selectedPreferences.has(settings.dietaryPreference));
            const matchesDietType = selectedDietTypes.size === 0 || (settings.dietType && selectedDietTypes.has(settings.dietType));
            const matchesComplexity = selectedComplexities.size === 0 || (settings.dishComplexity && selectedComplexities.has(settings.dishComplexity));
            const matchesGlutenFree = !filterGlutenFree || !!settings.isGlutenFree;
            const matchesLactoseFree = !filterLactoseFree || !!settings.isLactoseFree;
            return matchesSearch && matchesCategory && matchesPreference && matchesDietType && matchesComplexity && matchesGlutenFree && matchesLactoseFree;
        });
    }, [allRecipes, searchTerm, selectedMealCategories, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree]);
    
    return (
        <div className="space-y-8">
            <div className="space-y-6 bg-white/50 p-6 rounded-lg shadow-sm">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-700">Rezepte Archiv</h2>
                    <input type="text" placeholder="Suche nach Rezeptnamen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-auto md:max-w-xs px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                </div>
                <div className="space-y-4">
                    {/* FIX: Use Object.keys for type-safe iteration over string literal types. */}
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Mahlzeit:</span>{(Object.keys(MealCategoryLabels) as MealCategory[]).map(key => <FilterToggleButton key={key} label={MealCategoryLabels[key]} isSelected={selectedMealCategories.has(key)} onClick={() => handleFilterToggle(key, selectedMealCategories, setSelectedMealCategories)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährung:</span>{(Object.keys(dietPreferenceLabels) as Diet[]).map(key => <FilterToggleButton key={key} label={dietPreferenceLabels[key]} isSelected={selectedPreferences.has(key)} onClick={() => handleFilterToggle(key, selectedPreferences, setSelectedPreferences)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Diät-Typ:</span>{(Object.keys(dietTypeLabels) as DietType[]).map(key => <FilterToggleButton key={key} label={dietTypeLabels[key]} isSelected={selectedDietTypes.has(key)} onClick={() => handleFilterToggle(key, selectedDietTypes, setSelectedDietTypes)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Niveau:</span>{(Object.keys(dishComplexityLabels) as DishComplexity[]).map(key => <FilterToggleButton key={key} label={dishComplexityLabels[key]} isSelected={selectedComplexities.has(key)} onClick={() => handleFilterToggle(key, selectedComplexities, setSelectedComplexities)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Optionen:</span>
                        <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full has-[:checked]:bg-emerald-600 has-[:checked]:text-white"><input type="checkbox" checked={filterGlutenFree} onChange={(e) => setFilterGlutenFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" /><span>Nur Glutenfrei</span></label>
                        <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full has-[:checked]:bg-emerald-600 has-[:checked]:text-white"><input type="checkbox" checked={filterLactoseFree} onChange={(e) => setFilterLactoseFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" /><span>Nur Laktosefrei</span></label>
                    </div>
                </div>
            </div>

            {filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-bold text-slate-600 mb-2">Keine Rezepte gefunden</h2>
                    <p className="text-slate-500">Für die aktuellen Filter wurden keine Rezepte gefunden. Versuchen Sie, die Filter anzupassen.</p>
                </div>
            )}
        </div>
    );
};

export default RecipeArchiveComponent;