import { useState, useCallback } from 'react';
import type { Recipe } from '../types';
import * as apiService from '../services/apiService';

export const useImageGenerator = (onImageSaved: () => void) => {
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [key: string]: string | null }>({});

    const generateImage = useCallback(async (recipe: Recipe, attempt = 1): Promise<void> => {
        const uiKey = recipe.day || recipe.title; // Use day if available, otherwise title as a unique key for loading state
        setLoadingImages(prev => new Set(prev).add(uiKey));
        setImageErrors(prev => ({ ...prev, [uiKey]: null }));

        try {
            const result = await apiService.generateImage(recipe, attempt);
            await apiService.saveRecipeImage(recipe.title, result.imageUrl);
            onImageSaved(); // This will refetch the archive and update all UIs
        } catch (error) {
            console.error(`Error generating image for ${recipe.title}:`, error);
            setImageErrors(prev => ({ ...prev, [uiKey]: (error as Error).message }));
            // Optional: retry logic can be added here if needed
        } finally {
            setLoadingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(uiKey);
                return newSet;
            });
        }
    }, [onImageSaved]);

    const generateMissingImages = useCallback(async (
        recipes: Recipe[],
        currentImageUrls: { [key: string]: string },
        onProgress?: (status: string) => void
    ): Promise<void> => {
        const recipesToGenerate = recipes.filter(r => !currentImageUrls[r.day]);
        if (recipesToGenerate.length === 0) return;

        let imagesGenerated = false;

        for (let i = 0; i < recipesToGenerate.length; i++) {
            const recipe = recipesToGenerate[i];
            if (onProgress) {
                onProgress(`Generiere Bild ${i + 1}/${recipesToGenerate.length}: ${recipe.title}`);
            }
            const uiKey = recipe.day;
            setLoadingImages(prev => new Set(prev).add(uiKey));
            try {
                const result = await apiService.generateImage(recipe, 1);
                await apiService.saveRecipeImage(recipe.title, result.imageUrl);
                imagesGenerated = true; // Mark that at least one image was saved
            } catch (error) {
                console.error(`Error generating image for ${recipe.title} during batch generation:`, error);
                setImageErrors(prev => ({ ...prev, [uiKey]: (error as Error).message }));
            } finally {
                setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(uiKey);
                    return newSet;
                });
            }
        }
        
        if (imagesGenerated) {
            onImageSaved(); // Refetch archive once after all images are processed
        }
    }, [onImageSaved]);

    return { 
        loadingImages, 
        imageErrors, 
        generateImage, 
        generateMissingImages,
    };
};
