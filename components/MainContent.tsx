// Fix: Implemented the MainContent component to act as a view router, displaying the correct component based on the current view state.
import React from 'react';
import type { View, PlanData, PlanSettings, Recipe, ShoppingList, WeeklyPlan, ArchiveEntry, MealCategory } from '../types';
import WeeklyPlanComponent from './WeeklyPlan';
import ShoppingListComponent from './ShoppingList';
import RecipesComponent from './Recipes';
import ArchiveComponent from './Archive';
import RecipeArchiveComponent from './RecipeArchive';
import SettingsPanel from './SettingsPanel';
import PlannerComponent from './Planner';

interface MainContentProps {
  currentView: View;
  onSetView: (view: View) => void;
  plan: PlanData | null;
  settings: PlanSettings;
  allRecipes: Recipe[];
  archive: ArchiveEntry[];
  imageUrls: { [id: number]: { full: string; thumb: string; } };
  loadingImages: Set<number>;
  imageErrors: { [id: number]: string | null };
  isLoading: boolean;
  onSettingsChange: (settings: PlanSettings) => void;
  onGeneratePlan: () => void;
  onLoadPlan: (id: number) => void;
  onDeletePlan: (id: number) => void;
  onSelectRecipe: (day: string, mealType: MealCategory) => void;
  onPlanSaved: () => void;
  generateImage: (recipe: Recipe) => Promise<void>;
  generateMissingImages: (weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void) => Promise<{ [key: number]: { full: string; thumb: string; } }>;
  isBulkImageGenerating: boolean;
  onGenerateAllImages: () => void;
}

const MainContent: React.FC<MainContentProps> = (props) => {
  const {
    currentView,
    onSetView,
    plan,
    settings,
    allRecipes,
    archive,
    imageUrls,
    loadingImages,
    imageErrors,
    isLoading,
    onSettingsChange,
    onGeneratePlan,
    onLoadPlan,
    onDeletePlan,
    onSelectRecipe,
    onPlanSaved,
    generateImage,
    generateMissingImages,
    isBulkImageGenerating,
    onGenerateAllImages,
  } = props;

  const renderView = () => {
    switch (currentView) {
      case 'plan':
        return plan ? (
          <WeeklyPlanComponent
            weeklyPlan={plan.weeklyPlan}
            planName={plan.name}
            onSelectRecipe={onSelectRecipe}
            isGlutenFree={plan.settings.isGlutenFree}
            isLactoseFree={plan.settings.isLactoseFree}
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6 transition-colors duration-300 border border-slate-100 dark:border-slate-700">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100">Neuen Ernährungsplan erstellen</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto">
                    Passe die Einstellungen an und lass die KI einen individuellen Plan für dich erstellen. 
                    Alternativ kannst du einen bestehenden Plan aus deinem <button onClick={() => onSetView('archive')} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Archiv laden</button>.
                </p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onGeneratePlan={onGeneratePlan} isLoading={isLoading} allRecipes={allRecipes} />
            </div>
          </div>
        );
      case 'shopping':
        return plan ? <ShoppingListComponent shoppingList={plan.shoppingList} /> : <p>Kein Plan zum Anzeigen der Einkaufsliste vorhanden.</p>;
      case 'recipes':
        return plan ? (
          <RecipesComponent
            weeklyPlan={plan.weeklyPlan}
            recipes={plan.recipes}
            persons={plan.settings.persons}
            imageUrls={imageUrls}
            loadingImages={loadingImages}
            imageErrors={imageErrors}
            generateImage={generateImage}
            generateMissingImages={generateMissingImages}
            isBulkImageGenerating={isBulkImageGenerating}
            onGenerateAllImages={onGenerateAllImages}
          />
        ) : <p>Kein Plan zum Anzeigen der Rezepte vorhanden.</p>;
      case 'archive':
        return <ArchiveComponent archive={archive} onLoadPlan={onLoadPlan} onDeletePlan={onDeletePlan} />;
      case 'recipe-archive':
        return <RecipeArchiveComponent />;
      case 'planner':
        return <PlannerComponent 
            onPlanSaved={onPlanSaved} 
            imageUrls={imageUrls}
            loadingImages={loadingImages}
            imageErrors={imageErrors}
            generateImage={generateImage}
        />;
      default:
        return (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6 transition-colors duration-300 border border-slate-100 dark:border-slate-700">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100">Neuen Ernährungsplan erstellen</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto">
                        Passe die Einstellungen an und lass die KI einen individuellen Plan für dich erstellen. 
                        Alternativ kannst du einen bestehenden Plan aus deinem <button onClick={() => onSetView('archive')} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">Archiv laden</button>.
                    </p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onGeneratePlan={onGeneratePlan} isLoading={isLoading} allRecipes={allRecipes} />
                </div>
            </div>
        );
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {renderView()}
    </main>
  );
};

export default MainContent;