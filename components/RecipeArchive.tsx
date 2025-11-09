import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Recipe, Diet, MealCategory, DietType, DishComplexity } from '../types';
import * as apiService from '../services/apiService';
import { MealCategoryLabels } from '../types';
import RecipeDetailModal from './RecipeDetailModal';
import { useImageGenerator } from '../hooks/useImageGenerator';

const dietPreferenceLabels: Record<Diet, string> = { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan' };
const dietTypeLabels: Record<DietType, string> = { balanced: 'Ausgewogen', 'low-carb': 'Low-Carb', keto: 'Ketogen', 'high-protein': 'High-Protein', mediterranean: 'Mediterran' };
const dishComplexityLabels: Record<DishComplexity, string> = { simple: 'Einfach', advanced: 'Fortgeschritten', fancy: 'Pfiffig' };


const FilterToggleButton: React.FC<{ label: string; isSelected: boolean; onClick: () => void; }> = ({ label, isSelected, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1 text-sm rounded-full transition-colors font-medium whitespace-nowrap ${ isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300' }`}>{label}</button>
);

const RecipeCard: React.FC<{ recipe: Recipe; onSelect: (recipe: Recipe) => void }> = ({ recipe, onSelect }) => {
    return (
        <div 
            className="bg-white rounded-xl shadow-md overflow-hidden transition-shadow hover:shadow-lg flex flex-col cursor-pointer"
            onClick={() => onSelect(recipe)}
            role="button"
            aria-label={`Details für ${recipe.title} anzeigen`}
        >
            <div className="aspect-video bg-slate-100 flex items-center justify-center">
                {recipe.thumbnail_url || recipe.image_url ? (
                    <img src={recipe.thumbnail_url || recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                ) : (
                    <svg className="w-full h-full text-slate-300 p-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                )}
            </div>
            <div className="p-5 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-emerald-600 tracking-wide uppercase">{MealCategoryLabels[recipe.category]}</p>
                <h3 className="text-xl font-bold text-slate-800 mt-1 flex-grow leading-tight">{recipe.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{recipe.totalCalories} kcal</span>
                    {recipe.dietaryPreference && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full capitalize">{recipe.dietaryPreference === 'omnivore' ? 'Alles' : recipe.dietaryPreference}</span>}
                </div>
            </div>
        </div>
    );
};

const RecipeArchiveComponent: React.FC = () => {
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 60;
    const recipeArchiveContainerRef = useRef<HTMLDivElement>(null);


    const fetchRecipes = useCallback(() => {
        apiService.getAllRecipes()
            .then(data => {
                setAllRecipes(data);
            })
            .catch(error => {
                console.error("Failed to fetch recipe archive:", error);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchRecipes();
    }, [fetchRecipes]);

    const { imageUrls, loadingImages, imageErrors, generateImage, setImageUrlsFromArchive } = useImageGenerator(fetchRecipes);
    
    useEffect(() => {
        const initialImageUrls: { [id: number]: { full: string; thumb: string; } } = {};
        allRecipes.forEach(recipe => {
            if (recipe.image_url && recipe.thumbnail_url) {
                initialImageUrls[recipe.id] = { full: recipe.image_url, thumb: recipe.thumbnail_url };
            }
        });
        setImageUrlsFromArchive(initialImageUrls);
    }, [allRecipes, setImageUrlsFromArchive]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMealCategories, setSelectedMealCategories] = useState<Set<MealCategory>>(new Set());
    const [selectedPreferences, setSelectedPreferences] = useState<Set<Diet>>(new Set());
    const [selectedDietTypes, setSelectedDietTypes] = useState<Set<DietType>>(new Set());
    const [selectedComplexities, setSelectedComplexities] = useState<Set<DishComplexity>>(new Set());
    const [filterGlutenFree, setFilterGlutenFree] = useState(false);
    const [filterLactoseFree, setFilterLactoseFree] = useState(false);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedMealCategories, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree]);

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
            const matchesDietType = selectedDietTypes.size === 0 || (recipe.dietType && selectedDietTypes.has(recipe.dietType));
            const matchesComplexity = selectedComplexities.size === 0 || (recipe.dishComplexity && selectedComplexities.has(recipe.dishComplexity));
            const matchesGlutenFree = !filterGlutenFree || !!recipe.isGlutenFree;
            const matchesLactoseFree = !filterLactoseFree || !!recipe.isLactoseFree;
            
            return matchesSearch && matchesCategory && matchesPreference && matchesDietType && matchesComplexity && matchesGlutenFree && matchesLactoseFree;
        });
    }, [allRecipes, searchTerm, selectedMealCategories, selectedPreferences, selectedDietTypes, selectedComplexities, filterGlutenFree, filterLactoseFree]);

    const { paginatedRecipes, totalPages } = useMemo(() => {
        const totalPages = Math.ceil(filteredRecipes.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return {
          paginatedRecipes: filteredRecipes.slice(startIndex, endIndex),
          totalPages,
        };
    }, [filteredRecipes, currentPage]);
    
    if (isLoading) {
        return <div className="text-center py-16">Lade Rezepte...</div>;
    }

    return (
        <div className="space-y-0" ref={recipeArchiveContainerRef}>
            <div className="space-y-6 bg-white/50 p-6 rounded-lg shadow-sm">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-700">Rezepte Archiv</h2>
                    <input type="text" placeholder="Suche nach Rezeptnamen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-auto md:max-w-xs px-4 py-2 bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                </div>
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Mahlzeit:</span>{(Object.keys(MealCategoryLabels) as MealCategory[]).map(key => <FilterToggleButton key={key} label={MealCategoryLabels[key]} isSelected={selectedMealCategories.has(key)} onClick={() => handleFilterToggle(key, selectedMealCategories, setSelectedMealCategories)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Ernährung:</span>{(Object.keys(dietPreferenceLabels) as Diet[]).map(key => <FilterToggleButton key={key} label={dietPreferenceLabels[key]} isSelected={selectedPreferences.has(key)} onClick={() => handleFilterToggle(key, selectedPreferences, setSelectedPreferences)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Diät-Typ:</span>{(Object.keys(dietTypeLabels) as DietType[]).map(key => <FilterToggleButton key={key} label={dietTypeLabels[key]} isSelected={selectedDietTypes.has(key)} onClick={() => handleFilterToggle(key, selectedDietTypes, setSelectedDietTypes)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Koch-Niveau:</span>{(Object.keys(dishComplexityLabels) as DishComplexity[]).map(key => <FilterToggleButton key={key} label={dishComplexityLabels[key]} isSelected={selectedComplexities.has(key)} onClick={() => handleFilterToggle(key, selectedComplexities, setSelectedComplexities)} />)}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-sm font-medium text-slate-600 mr-2 shrink-0">Optionen:</span>
                        <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                            <input type="checkbox" checked={filterGlutenFree} onChange={(e) => setFilterGlutenFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" />
                            <span>Nur Glutenfrei</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-full transition-colors has-[:checked]:bg-emerald-600 has-[:checked]:text-white has-[:checked]:shadow-sm">
                            <input type="checkbox" checked={filterLactoseFree} onChange={(e) => setFilterLactoseFree(e.target.checked)} className="h-0 w-0 absolute opacity-0" />
                            <span>Nur Laktosefrei</span>
                        </label>
                    </div>
                </div>
            </div>

            {filteredRecipes.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                        {paginatedRecipes.map(recipe => (
                            <RecipeCard key={recipe.id} recipe={recipe} onSelect={setSelectedRecipe} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 pt-4 border-t border-slate-200">
                            <button
                                onClick={() => {
                                    setCurrentPage(prev => Math.max(1, prev - 1));
                                    recipeArchiveContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Zurück
                            </button>
                            <span className="text-slate-600 font-medium">
                                Seite {currentPage} von {totalPages}
                            </span>
                            <button
                                onClick={() => {
                                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                    recipeArchiveContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Weiter
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-bold text-slate-600 mb-2">Keine Rezepte gefunden</h2>
                    <p className="text-slate-500">Für die aktuellen Filter wurden keine Rezepte gefunden. Versuchen Sie, die Filter anzupassen.</p>
                </div>
            )}

            {selectedRecipe && (
                <RecipeDetailModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                    imageUrl={imageUrls[selectedRecipe.id]?.full || selectedRecipe.image_url || null}
                    isLoading={loadingImages.has(selectedRecipe.id)}
                    error={imageErrors[selectedRecipe.id] || null}
                    onGenerate={generateImage}
                />
            )}
        </div>
    );
};

export default RecipeArchiveComponent;