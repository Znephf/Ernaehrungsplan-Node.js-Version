import { useState, useCallback, useEffect } from 'react';
import type { Recipe, ArchiveEntry } from '../types';
import * as apiService from '../services/apiService';

export const useImageGenerator = (
    currentPlan: ArchiveEntry | null,
    updatePlanInState: (plan: ArchiveEntry) => void
) => {
    const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [key: string]: string | null }>({});
    
    // Effect to update local state when a new plan is loaded
    useEffect(() => {
        setImageUrls(currentPlan?.imageUrls || {});
    }, [currentPlan]);

    const generateImage = useCallback(async (recipe: Recipe, planId: number | null, attempt = 1): Promise<void> => {
        if (!planId || !currentPlan) return;

        setLoadingImages(prev => new Set(prev).add(recipe.day));
        setImageErrors(prev => ({ ...prev, [recipe.day]: null }));

        try {
            const result = await apiService.generateImage(recipe, attempt);
            const newImageUrl = result.imageUrl;

            // Update local state immediately for responsiveness
            setImageUrls(prev => ({ ...prev, [recipe.day]: newImageUrl }));

            // Create a deep copy of the plan to avoid direct mutation
            const updatedPlan = JSON.parse(JSON.stringify(currentPlan));
            if (!updatedPlan.imageUrls) {
                updatedPlan.imageUrls = {};
            }
            updatedPlan.imageUrls[recipe.day] = newImageUrl;

            // Update the plan in the parent state
            updatePlanInState(updatedPlan);

            // Persist the change to the backend
            await apiService.updatePlan(updatedPlan);

        } catch (error) {
            console.error(`Error generating image for ${recipe.title}:`, error);
            setImageErrors(prev => ({ ...prev, [recipe.day]: (error as Error).message }));
            // Retry logic
            if (attempt < 3) {
                console.log(`Retrying image generation for ${recipe.title} (attempt ${attempt + 1})`);
                setTimeout(() => generateImage(recipe, planId, attempt + 1), 2000);
            }
        } finally {
            setLoadingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(recipe.day);
                return newSet;
            });
        }
    }, [currentPlan, updatePlanInState]);

     const generateMissingImages = useCallback(async (
        recipes: Recipe[],
        planId: number | null,
        onProgress?: (status: string) => void
    ): Promise<{ [key: string]: string }> => {
        if (!planId || !currentPlan) return {};

        const recipesToGenerate = recipes.filter(r => !(currentPlan.imageUrls && currentPlan.imageUrls[r.day]));
        if (recipesToGenerate.length === 0) return currentPlan.imageUrls || {};

        const newImageUrls: { [key: string]: string } = { ...(currentPlan.imageUrls || {}) };

        for (let i = 0; i < recipesToGenerate.length; i++) {
            const recipe = recipesToGenerate[i];
            
            if (onProgress) {
                onProgress(`Generiere Bild ${i + 1}/${recipesToGenerate.length}: ${recipe.title}`);
            }

            try {
                // We don't use the stateful `generateImage` here to avoid multiple separate updates.
                setLoadingImages(prev => new Set(prev).add(recipe.day));
                const result = await apiService.generateImage(recipe, 1);
                newImageUrls[recipe.day] = result.imageUrl;
                setImageUrls(prev => ({ ...prev, [recipe.day]: result.imageUrl }));
            } catch (error) {
                console.error(`Error generating image for ${recipe.title} during batch generation:`, error);
                setImageErrors(prev => ({ ...prev, [recipe.day]: (error as Error).message }));
            } finally {
                setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(recipe.day);
                    return newSet;
                });
            }
        }
        
        const updatedPlan = { ...currentPlan, imageUrls: newImageUrls };
        updatePlanInState(updatedPlan);
        await apiService.updatePlan(updatedPlan);

        return newImageUrls;
    }, [currentPlan, updatePlanInState]);

    // This function is needed to reset image state when loading a new plan
    const resetImageStateForNewPlan = (plan: ArchiveEntry | null) => {
        setImageUrls(plan?.imageUrls || {});
        setLoadingImages(new Set());
        setImageErrors({});
    };

    return { 
        imageUrls, 
        loadingImages, 
        imageErrors, 
        generateImage, 
        generateMissingImages, 
        resetImageStateForNewPlan 
    };
};
