import { useState } from 'react';
import type { PlanSettings, ArchiveEntry, PlanData } from '../types';
import { shoppingList as initialShoppingList, weeklyPlan as initialWeeklyPlan, recipes as initialRecipes } from '../data';

const initialPlan = {
  name: 'Low-Carb Woche',
  shoppingList: initialShoppingList,
  weeklyPlan: initialWeeklyPlan,
  recipes: initialRecipes,
  imageUrls: {}
};

interface GenerationResult {
    success: boolean;
    newPlan: PlanData | null;
    newPlanId: string | null;
}

export const useMealPlanGenerator = () => {
    const [plan, setPlan] = useState<PlanData>(initialPlan);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const generateNewPlan = async (settings: PlanSettings): Promise<GenerationResult> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    settings,
                    // Send previous recipe titles to ensure variety
                    previousPlanRecipes: (plan && plan.name !== initialPlan.name) ? plan.recipes : [] 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Serverfehler: ${response.statusText}`);
            }

            const { data: newPlanData, id: newPlanId, debug: debugInfo } = await response.json();

            console.groupCollapsed('[DEBUG] Ernährungsplan-Generierung (2-stufig)');
            console.log('--- Gesendete Einstellungen ---');
            console.log(settings);
            console.log('--- Prompt 1: Plan & Rezepte ---');
            console.log(debugInfo.planPrompt);
            console.log('--- Prompt 2: Einkaufsliste ---');
            console.log(debugInfo.shoppingListPrompt);
            console.groupEnd();


            if (!newPlanData.recipes || !newPlanData.weeklyPlan || !newPlanData.shoppingList || newPlanData.recipes.length === 0) {
                throw new Error("Die von der KI generierte Antwort war unvollständig.");
            }
            
            setPlan(newPlanData);
            return { success: true, newPlan: newPlanData, newPlanId };

        } catch (e) {
            console.error(e);
            setError(`Der Ernährungsplan konnte nicht erstellt werden: ${(e as Error).message}. Bitte versuchen Sie es später erneut.`);
            return { success: false, newPlan: null, newPlanId: null };
        } finally {
            setIsLoading(false);
        }
    };
    
    const setPlanFromArchive = (archiveEntry: ArchiveEntry) => {
        setPlan({
            name: archiveEntry.name,
            shoppingList: archiveEntry.shoppingList,
            weeklyPlan: archiveEntry.weeklyPlan,
            recipes: archiveEntry.recipes,
            imageUrls: archiveEntry.imageUrls || {}
        });
    };

    return { plan, setPlan: setPlanFromArchive, isLoading, error, generateNewPlan };
};