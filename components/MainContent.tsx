import React from 'react';
import type { View, ArchiveEntry, Recipe, Recipes, WeeklyPlan } from '../types';
import ShoppingListComponent from './ShoppingList';
import WeeklyPlanComponent from './WeeklyPlan';
import RecipesComponent from './Recipes';
import ArchiveComponent from './Archive';
import PlannerComponent from './Planner';
import RecipeArchiveComponent from './RecipeArchive';

interface MainContentProps {
    view: View;
    plan: ArchiveEntry | null;
    archive: ArchiveEntry[];
    imageUrls: { [id: number]: string };
    loadingImages: Set<number>;
    imageErrors: { [id: number]: string | null };
    onSelectRecipe: (day: string) => void;
    onLoadPlan: (id: number) => void;
    onGenerateImage: (recipe: Recipe) => Promise<void>;
    onGenerateMissingImages: (weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void) => Promise<{ [key: string]: string }>;
    onCustomPlanSaved: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
    view,
    plan,
    archive,
    imageUrls,
    loadingImages,
    imageErrors,
    onSelectRecipe,
    onLoadPlan,
    onGenerateImage,
    onGenerateMissingImages,
    onCustomPlanSaved,
}) => {

    const renderView = () => {
        switch (view) {
            case 'shopping':
                return plan ? <ShoppingListComponent shoppingList={plan.shoppingList} /> : null;
            case 'plan':
                return plan ? <WeeklyPlanComponent 
                                weeklyPlan={plan.weeklyPlan} 
                                planName={plan.name} 
                                onSelectRecipe={onSelectRecipe}
                                isGlutenFree={(plan.settings || {}).isGlutenFree}
                                isLactoseFree={(plan.settings || {}).isLactoseFree}
                             /> : null;
            case 'recipes':
                return plan ? <RecipesComponent 
                            weeklyPlan={plan.weeklyPlan}
                            recipes={plan.recipes} 
                            persons={(plan.settings || {}).persons}
                            imageUrls={imageUrls}
                            loadingImages={loadingImages}
                            imageErrors={imageErrors}
                            generateImage={onGenerateImage}
                            generateMissingImages={onGenerateMissingImages}
                        /> : null;
            case 'archive':
                return <ArchiveComponent archive={archive} onLoadPlan={onLoadPlan} />;
            case 'recipe-archive':
                return <RecipeArchiveComponent archive={archive} />;
            case 'planner':
                return <PlannerComponent archive={archive} onPlanSaved={onCustomPlanSaved} />;
            default:
                return null;
        }
    };

    return (
        <>
            {renderView()}

            {!plan && view !== 'archive' && view !== 'planner' && view !== 'recipe-archive' && (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Willkommen beim KI Ernährungsplaner</h2>
                    <p className="text-slate-500">Erstellen Sie oben einen neuen Plan oder laden Sie einen bestehenden aus dem Archiv.</p>
                </div>
            )}
        </>
    );
};

export default MainContent;