import { useState } from 'react';
import type { PlanSettings, ArchiveEntry, PlanData } from '../types';
import { shoppingList as initialShoppingList, weeklyPlan as initialWeeklyPlan, recipes as initialRecipes } from '../data';

const initialPlan = {
  name: 'Low-Carb Woche',
  shoppingList: initialShoppingList,
  weeklyPlan: initialWeeklyPlan,
  recipes: initialRecipes
};

export const useMealPlanGenerator = (
    addPlanToArchive: (plan: Omit<ArchiveEntry, 'id' | 'createdAt'>) => void
) => {
    const [plan, setPlan] = useState<PlanData>(initialPlan);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const generateNewPlan = async (settings: PlanSettings) => {
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

            const { data: newPlanData, debug: debugInfo } = await response.json();

            console.groupCollapsed('[DEBUG] Ernährungsplan-Generierung');
            console.log('--- Gesendete Einstellungen ---');
            console.log(settings);
            console.log('--- Prompt für den Plan ---');
            console.log(debugInfo.planPrompt);
            console.log('--- Prompt für den Namen ---');
            console.log(debugInfo.namePrompt);
            console.groupEnd();


            if (!newPlanData.recipes || !newPlanData.weeklyPlan || !newPlanData.shoppingList || newPlanData.recipes.length === 0) {
                throw new Error("Die von der KI generierte Antwort war unvollständig.");
            }
            
            setPlan(newPlanData);

            addPlanToArchive({
                ...settings,
                ...newPlanData,
            });

        } catch (e) {
            console.error(e);
            setError(`Der Ernährungsplan konnte nicht erstellt werden: ${(e as Error).message}. Bitte versuchen Sie es später erneut.`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const setPlanFromArchive = (archiveEntry: ArchiveEntry) => {
        setPlan({
            name: archiveEntry.name,
            shoppingList: archiveEntry.shoppingList,
            weeklyPlan: archiveEntry.weeklyPlan,
            recipes: archiveEntry.recipes
        });
    };

    return { plan, setPlan: setPlanFromArchive, isLoading, error, generateNewPlan };
};