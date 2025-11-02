// Fix: Implemented the MainContent component to act as a view router, displaying the correct component based on the current view state.
import React from 'react';
import type { View, PlanData, PlanSettings, Recipe, ShoppingList, WeeklyPlan, ArchiveEntry } from '../types';
import WeeklyPlanComponent from './WeeklyPlan';
import ShoppingListComponent from './ShoppingList';
import RecipesComponent from './Recipes';
import ArchiveComponent from './Archive';
import RecipeArchiveComponent from './RecipeArchive';
import SettingsPanel from './SettingsPanel';
import PlannerComponent from './Planner';

interface MainContentProps {
  currentView: View;
  plan: PlanData | null;
  settings: PlanSettings;
  archive: ArchiveEntry[];
  imageUrls: { [id: number]: string };
  loadingImages: Set<number>;
  imageErrors: { [id: number]: string | null };
  isLoading: boolean;
  onSettingsChange: (settings: PlanSettings) => void;
  onGeneratePlan: () => void;
  onLoadPlan: (id: number) => void;
  onSelectRecipe: (day: string) => void;
  onPlanSaved: () => void;
  generateImage: (recipe: Recipe) => Promise<void>;
  generateMissingImages: (weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void) => Promise<{ [key: string]: string }>;
}

const MainContent: React.FC<MainContentProps> = (props) => {
  const {
    currentView,
    plan,
    settings,
    archive,
    imageUrls,
    loadingImages,
    imageErrors,
    isLoading,
    onSettingsChange,
    onGeneratePlan,
    onLoadPlan,
    onSelectRecipe,
    onPlanSaved,
    generateImage,
    generateMissingImages,
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
          <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onGeneratePlan={onGeneratePlan} isLoading={isLoading} />
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
          />
        ) : <p>Kein Plan zum Anzeigen der Rezepte vorhanden.</p>;
      case 'archive':
        return <ArchiveComponent archive={archive} onLoadPlan={onLoadPlan} />;
      case 'recipe-archive':
        return <RecipeArchiveComponent />;
      case 'planner':
        return <PlannerComponent onPlanSaved={onPlanSaved} />;
      default:
        return <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onGeneratePlan={onGeneratePlan} isLoading={isLoading} />;
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {renderView()}
    </main>
  );
};

export default MainContent;