import React from 'react';
import type { View, ArchiveEntry, Recipe, Recipes } from '../types';
import ShoppingListComponent from './ShoppingList';
import WeeklyPlanComponent from './WeeklyPlan';
import RecipesComponent from './Recipes';
import ArchiveComponent from './Archive';
import PlannerComponent from './Planner';

interface MainContentProps {
    view: View;
    plan: ArchiveEntry | null;
    archive: ArchiveEntry[];
    imageUrls: { [key: string]: string };
    loadingImages: Set<string>;
    imageErrors: { [key: string]: string | null };
    onSelectRecipe: (day: string) => void;
    onLoadPlan: (id: number) => void;
    onGenerateImage: (recipe: Recipe, planId: number | null) => Promise<void>;
    onGenerateMissingImages: (recipes: Recipe[], planId: number | null, onProgress?: (status: string) => void) => Promise<{ [key: string]: string }>;
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
                                isGlutenFree={plan.isGlutenFree}
                                isLactoseFree={plan.isLactoseFree}
                             /> : null;
            case 'recipes':
                return plan ? <RecipesComponent 
                            recipes={plan.recipes} 
                            planId={plan.id}
                            persons={plan.persons}
                            imageUrls={imageUrls}
                            loadingImages={loadingImages}
                            imageErrors={imageErrors}
                            generateImage={onGenerateImage}
                            generateMissingImages={onGenerateMissingImages}
                        /> : null;
            case 'archive':
                return <ArchiveComponent archive={archive} onLoadPlan={onLoadPlan} />;
            case 'planner':
                return <PlannerComponent archive={archive} onPlanSaved={onCustomPlanSaved} />;
            default:
                return null;
        }
    };

    return (
        <>
            {renderView()}

            {!plan && view !== 'archive' && view !== 'planner' && (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Willkommen beim KI Ernährungsplaner</h2>
                    <p className="text-slate-500">Erstellen Sie oben einen neuen Plan oder laden Sie einen bestehenden aus dem Archiv.</p>
                </div>
            )}
        </>
    );
};

export default MainContent;
