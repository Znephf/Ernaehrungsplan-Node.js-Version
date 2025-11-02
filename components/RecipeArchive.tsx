import React, { useState, useMemo, useEffect } from 'react';
import type { Recipe, Diet, DietType, DishComplexity, MealCategory } from '../types';
import * as apiService from '../services/apiService';
import { MealCategoryLabels } from '../types';
import { ProteinIcon, CarbsIcon, FatIcon, ChevronDownIcon } from './IconComponents';

interface RecipeArchiveProps {}

const dietPreferenceLabels: Record<Diet, string> = { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan' };

const FilterToggleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${ isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300' }`}>{label}</button>
);

const RecipeCard: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden transition-shadow hover:shadow-lg flex flex-col">
            {recipe.image_url && (
                <div className="aspect-video bg-slate-100">
                    <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="p-5 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-emerald-600 tracking-wide uppercase">{MealCategoryLabels[recipe.category]}</p>
                <h3 className="text-xl font-bold text-slate-800 mt-1 flex-grow leading-tight">{recipe.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{recipe.totalCalories} kcal</span>
                    {recipe.dietaryPreference && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full capitalize">{recipe.dietaryPreference === 'omnivore' ? 'Alles' : recipe.dietaryPreference}</span>}
                </div>
            </div>

            <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <div className="px-5 pb-5 pt-2 space-y-4">
                     {recipe.protein !== undefined && (
                        <div className="flex justify-around items-start text-center gap-x-2 gap-y-1 text-slate-600 p-2 bg-slate-50 rounded-lg">
                             <span className="flex flex-col items-center text-xs space-y-1">
                                <ProteinIcon className="h-5 w-5 text-emerald-600" />
                                <span className="font-bold">{recipe.protein}g</span>
                                <span className="text-slate-500 text-xs">Protein</span>
                            </span>
                             <span className="flex flex-col items-center text-xs space-y-1">
                                <CarbsIcon className="h-5 w-5 text-emerald-600" />
                                <span className="font-bold">{recipe.carbs}g</span>
                                <span className="text-slate-500 text-xs">Kohlenh.</span>
                            </span>
                             <span className="flex flex-col items-center text-xs space-y-1">
                                <FatIcon className="h-5 w-5 text-emerald-600" />
                                <span className="font-bold">{recipe.fat}g</span>
                                <span className="text-slate-500 text-xs">Fett</span>
                            </span>
                        </div>
                    )}
                    <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-1">Zutaten:</h4>
                        <ul className="space-y-1 list-disc list-inside text-slate-600 text-sm">{(recipe.ingredients || []).map((ing, i) => <li key={i}>{ing}</li>)}</ul>
                    </div>
                     <div>
                        <h4 className="font-semibold text-slate-700 text-sm mb-1">Anleitung:</h4>
                        <ol className="space-y-2 list-decimal list-inside text-slate-600 text-sm">{(recipe.instructions || []).map((step, i) => <li key={i}>{step}</li>)}</ol>
                    </div>
                </div>
            </div>
            
            <div className="border-t border-slate-200 mt-auto">
                 <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors">
                    <span>{isExpanded ? 'Weniger anzeigen' : 'Mehr erfahren'}</span>
                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </div>
    );
};


const RecipeArchiveComponent: React.FC<RecipeArchiveProps> = () => {
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        apiService.getAllRecipes()
            .then(data => {
                setAllRecipes(data);
                setIsLoading(false);
            })
            .catch(error => {
                console.error("Failed to fetch recipe archive:", error);
                setIsLoading(false);
            });
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMealCategories, setSelectedMealCategories] = useState<Set<MealCategory>>(new Set());
    const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
    
    const handleFilterToggle = <T extends string>(value: T, currentFilters: Set<T>, setFilters: React.Dispatch<React.SetStateAction<Set<T>>>) => {
        const newFilters = new Set(currentFilters);
        newFilters.has(value) ? newFilters.delete(value) : newFilters.add(value);
        setFilters(newFilters);
    };

    const filteredRecipes = useMemo(() => {
        return allRecipes.filter(recipe => {
            const matchesSearch = !searchTerm.trim() || recipe.title.toLowerCase().includes(searchTerm.toLowerCase().trim());
            const matchesCategory = selectedMealCategories.size === 0 || selectedMealCategories.has(recipe.category);
            const matchesPreference = selectedPreferences.size === 0 || (recipe.dietaryPreference && selectedPreferences.has(recipe.dietaryPreference));
            return matchesSearch && matchesCategory && matchesPreference;
        });
    }, [allRecipes, searchTerm, selectedMealCategories, selectedPreferences]);
    
    if (isLoading) {
        return <div className="text-center py-16">Lade Rezepte...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="space-y-6 bg-white/50 p-6 rounded-lg shadow-sm">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-700">Rezepte Archiv</h2>
                    <input type="text" placeholder="Suche nach Rezeptnamen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-auto md:max-w-xs px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                </div>
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Mahlzeit:</span>{(Object.keys(MealCategoryLabels) as MealCategory[]).map(key => <FilterToggleButton key={key} label={MealCategoryLabels[key]} isSelected={selectedMealCategories.has(key)} onClick={() => handleFilterToggle(key, selectedMealCategories, setSelectedMealCategories)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährung:</span>{(Object.keys(dietPreferenceLabels) as Diet[]).map(key => <FilterToggleButton key={key} label={dietPreferenceLabels[key]} isSelected={selectedPreferences.has(key)} onClick={() => handleFilterToggle(key, selectedPreferences, setSelectedPreferences)} />)}</div>
                </div>
            </div>

            {filteredRecipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
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