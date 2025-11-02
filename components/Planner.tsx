import React, { useState, useMemo } from 'react';
import type { ArchiveEntry, Recipe } from '../types';
import * as apiService from '../services/apiService';

interface PlannerComponentProps {
    archive: ArchiveEntry[];
    onPlanSaved: () => void;
}

const PlannerComponent: React.FC<PlannerComponentProps> = ({ archive, onPlanSaved }) => {
    const [planName, setPlanName] = useState('Individueller Wochenplan');
    const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const allRecipes = useMemo(() => {
        const recipeMap = new Map<string, Recipe>();
        archive.forEach(plan => {
            plan.recipes.forEach(recipe => {
                // Use a simple title-based key to avoid duplicates
                const key = recipe.title.toLowerCase().trim();
                if (!recipeMap.has(key)) {
                    recipeMap.set(key, recipe);
                }
            });
        });
        return Array.from(recipeMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [archive]);
    
    const isRecipeSelected = (recipe: Recipe) => {
        return selectedRecipes.some(r => r.title === recipe.title);
    };

    const handleSelectRecipe = (recipe: Recipe) => {
        setSelectedRecipes(prev => {
            if (isRecipeSelected(recipe)) {
                return prev.filter(r => r.title !== recipe.title);
            } else {
                 if (prev.length >= 7) {
                    alert("Sie können maximal 7 Rezepte für einen Wochenplan auswählen.");
                    return prev;
                }
                return [...prev, recipe];
            }
        });
    };

    const handleSavePlan = async () => {
        if (selectedRecipes.length === 0 || !planName.trim()) {
            setError("Bitte geben Sie einen Namen an und wählen Sie mindestens ein Rezept aus.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await apiService.saveCustomPlan({
                name: planName,
                recipes: selectedRecipes,
            });
            onPlanSaved();
            // Optional: reset state after saving
            setPlanName('Individueller Wochenplan');
            setSelectedRecipes([]);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-slate-700">Wochenplaner</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recipe Selection Column */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xl font-semibold text-slate-600">1. Rezepte aus dem Archiv auswählen ({selectedRecipes.length}/7)</h3>
                    <div className="max-h-[60vh] overflow-y-auto bg-white p-4 rounded-lg shadow-md space-y-2">
                        {allRecipes.length > 0 ? allRecipes.map((recipe, index) => (
                            <div key={index} 
                                onClick={() => handleSelectRecipe(recipe)}
                                className={`p-3 rounded-md cursor-pointer transition-colors flex justify-between items-center ${isRecipeSelected(recipe) ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100'}`}
                            >
                                <span className="font-medium">{recipe.title}</span>
                                <input 
                                    type="checkbox"
                                    checked={isRecipeSelected(recipe)}
                                    readOnly
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                                />
                            </div>
                        )) : (
                            <p className="text-slate-500 text-center py-8">Keine Rezepte im Archiv gefunden. Bitte generieren Sie zuerst einen Plan.</p>
                        )}
                    </div>
                </div>

                {/* Plan Summary and Save Column */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-slate-600">2. Plan benennen und speichern</h3>
                    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
                        <div>
                            <label htmlFor="planName" className="block text-sm font-medium text-slate-700">Name des Plans</label>
                            <input
                                type="text"
                                id="planName"
                                value={planName}
                                onChange={(e) => setPlanName(e.target.value)}
                                className="mt-1 block w-full bg-white text-slate-900 rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-700">Ausgewählte Gerichte:</h4>
                            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                                {selectedRecipes.map((recipe, index) => <li key={index}>{recipe.title}</li>)}
                                {selectedRecipes.length === 0 && <li className="text-slate-400 list-none">Noch keine Gerichte ausgewählt.</li>}
                            </ul>
                        </div>
                         {error && <p className="text-sm text-red-600">{error}</p>}
                        <button
                            onClick={handleSavePlan}
                            disabled={isLoading || selectedRecipes.length === 0 || !planName.trim()}
                            className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Speichere...' : 'Individuellen Plan speichern'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlannerComponent;
