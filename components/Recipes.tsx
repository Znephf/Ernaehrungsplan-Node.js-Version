import React, { useState } from 'react';
import type { Recipe, Recipes } from '../types';
import GeneratedRecipeImage from './GeneratedRecipeImage';
import { DownloadIcon, FireIcon, ProteinIcon, CarbsIcon, FatIcon, ChevronUpIcon, ChevronDownIcon } from './IconComponents';

interface RecipesComponentProps {
  recipes: Recipes;
  persons: number;
  imageUrls: { [key:string]: string };
  loadingImages: Set<string>;
  imageErrors: { [key:string]: string | null };
  generateImage: (recipe: Recipe) => Promise<void>;
  generateMissingImages: (recipes: Recipe[], onProgress?: (status: string) => void) => Promise<void>;
}

const RecipesComponent: React.FC<RecipesComponentProps> = ({ 
    recipes, persons, imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages
}) => {
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [collapsedRecipes, setCollapsedRecipes] = useState<Set<string>>(new Set());

  const handleGenerateMissing = async () => {
    setIsGeneratingAll(true);
    setGenerationStatus('Starte Bildgenerierung...');
    try {
        await generateMissingImages(recipes, (status) => {
            setGenerationStatus(status);
        });
    } catch (error) {
        console.error("Fehler beim Generieren aller Bilder:", error);
        setGenerationStatus(`Ein Fehler ist aufgetreten.`);
    } finally {
        setTimeout(() => {
            setIsGeneratingAll(false);
            setGenerationStatus('');
        }, 3000);
    }
  };

  const toggleRecipeCollapse = (day: string) => {
      setCollapsedRecipes(prev => {
          const newSet = new Set(prev);
          if (newSet.has(day)) {
              newSet.delete(day);
          } else {
              newSet.add(day);
          }
          return newSet;
      });
  };

  const hasMissingImages = recipes.some(r => !imageUrls[r.day]);
  const sortedRecipes = [...recipes].sort((a, b) => {
      const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
      return days.indexOf(a.day) - days.indexOf(b.day);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="text-center sm:text-left">
            <h2 className="text-3xl font-bold text-slate-700">Kochanleitungen für das Abendessen</h2>
            <p className="text-slate-500">Alle Rezepte sind für {persons} Person{persons > 1 ? 'en' : ''} ausgelegt.</p>
        </div>
        {hasMissingImages && (
             <button
                onClick={handleGenerateMissing}
                disabled={isGeneratingAll}
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
             >
                <DownloadIcon />
                <span>{isGeneratingAll ? 'Generiere...' : 'Alle Bilder erstellen'}</span>
            </button>
        )}
      </div>

       {isGeneratingAll && <p className="text-center text-slate-600 animate-pulse">{generationStatus}</p>}

      <div className="space-y-12">
        {sortedRecipes.map((recipe) => {
            const isCollapsed = collapsedRecipes.has(recipe.day);
            return (
                <div key={recipe.day} className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300">
                    <GeneratedRecipeImage 
                        recipeTitle={recipe.title}
                        imageUrl={imageUrls[recipe.day] || null}
                        isLoading={loadingImages.has(recipe.day)}
                        error={imageErrors[recipe.day] || null}
                        onGenerate={() => generateImage(recipe)}
                    />
                    <div className="p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                           <div className="flex-grow">
                                <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">{recipe.day}</span>
                                <h3 className="text-2xl font-bold text-slate-800 mt-3">{recipe.title}</h3>
                           </div>
                           <button onClick={() => toggleRecipeCollapse(recipe.day)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" aria-label={isCollapsed ? "Rezept ausklappen" : "Rezept einklappen"}>
                                {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                            </button>
                        </div>
                        
                        {!isCollapsed && (
                            <div className="mt-4 animate-fade-in">
                                <div className="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-fit">
                                    <FireIcon />
                                    <span>ca. {recipe.totalCalories} kcal pro Portion</span>
                                </div>
                                
                                {recipe.protein !== undefined && (
                                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">
                                        <span className="flex items-center gap-1.5 text-sm"><ProteinIcon /><div><span className="font-bold">{recipe.protein}g</span><span className="text-slate-500 text-xs block">Protein</span></div></span>
                                        <span className="flex items-center gap-1.5 text-sm"><CarbsIcon /><div><span className="font-bold">{recipe.carbs}g</span><span className="text-slate-500 text-xs block">Kohlenh.</span></div></span>
                                        <span className="flex items-center gap-1.5 text-sm"><FatIcon /><div><span className="font-bold">{recipe.fat}g</span><span className="text-slate-500 text-xs block">Fett</span></div></span>
                                    </div>
                                )}
                                
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
                                    <div className="md:col-span-2">
                                        <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>
                                        <ul className="space-y-2 list-disc list-inside text-slate-600">
                                            {(recipe.ingredients || []).map((ing, i) => <li key={i}>{ing}</li>)}
                                        </ul>
                                    </div>
                                    <div className="md:col-span-3 md:border-l md:border-slate-200 md:pl-8">
                                        <h4 className="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                                        <ol className="space-y-3 list-decimal list-inside text-slate-600">
                                            {(recipe.instructions || []).map((step, i) => <li key={i}>{step}</li>)}
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
      </div>
       <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RecipesComponent;
