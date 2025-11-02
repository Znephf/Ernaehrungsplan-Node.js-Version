import { useState, useCallback } from 'react';
// Fix: Added WeeklyPlan to imports
import type { Recipe, WeeklyPlan } from '../types';
import * as apiService from '../services/apiService';

export const useImageGenerator = (onImageSaved?: () => void) => {
    const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [key: string]: string | null }>({});
    
    // This function now returns the raw base64 data URL
    const executeImageGeneration = useCallback(async (recipe: Recipe, day: string): Promise<string | null> => {
        const maxAttempts = 10;
        let lastKnownError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { apiResponse, debug } = await apiService.generateImage(recipe, attempt);

                console.groupCollapsed(`[DEBUG] Bild-Generierung für: "${recipe.title}" (Versuch ${attempt})`);
                console.log(debug.imagePrompt);
                console.groupEnd();

                if (apiResponse.promptFeedback?.blockReason) {
                    throw new Error(`Anfrage blockiert (${apiResponse.promptFeedback.blockReason})`);
                }

                const candidate = apiResponse?.candidates?.[0];
                if (!candidate) throw new Error("Keine Bild-Vorschläge erhalten.");
                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    if (candidate.finishReason === 'SAFETY') throw new Error("Aus Sicherheitsgründen blockiert.");
                    throw new Error(`Generierung gestoppt: ${candidate.finishReason}`);
                }

                const imagePart = candidate.content?.parts?.find((p: any) => p.inlineData);
                if (imagePart?.inlineData) {
                    return `data:image/png;base64,${imagePart.inlineData.data}`;
                } else {
                    throw new Error("Antwort enthält keine Bilddaten.");
                }
            } catch (e) {
                lastKnownError = e as Error;
                console.warn(`Bildgenerierungsversuch ${attempt} fehlgeschlagen:`, e);
                const errorMsg = (lastKnownError.message || '').toLowerCase();
                if (errorMsg.includes('blockiert') || errorMsg.includes('sicherheit') || errorMsg.includes('quota')) {
                    break;
                }
            }
        }

        const finalErrorMessage = lastKnownError?.message || "Unbekannter Fehler.";
        // Fix: Use `day` as the key for setting errors.
        setImageErrors(prev => ({ ...prev, [day]: `Fehler: ${finalErrorMessage}` }));
        return null;
    }, []);

    // Fix: Updated function signature to accept `day` as an argument.
    const generateImage = useCallback(async (recipe: Recipe, day: string) => {
        if (loadingImages.has(day)) return;

        setLoadingImages(prev => new Set(prev).add(day));
        setImageErrors(prev => ({ ...prev, [day]: null }));

        const base64ImageUrl = await executeImageGeneration(recipe, day);

        if (base64ImageUrl) {
            try {
                const base64Data = base64ImageUrl.split(';base64,').pop();
                if (!base64Data) throw new Error("Konnte Bilddaten nicht extrahieren.");
                
                // Send base64 to the backend, which saves it centrally and returns the file URL
                const { imageUrl: fileUrl } = await apiService.saveRecipeImage(recipe.id, base64Data);
                
                // Optimistic UI update
                setImageUrls(prev => ({ ...prev, [day]: fileUrl }));
                
                // Trigger a full data refresh to ensure consistency across the app
                if (onImageSaved) onImageSaved();

            } catch (e) {
                console.error("Konnte Bild nicht im Backend speichern:", e);
                setImageErrors(prev => ({ ...prev, [day]: `Speicherfehler: ${(e as Error).message}` }));
            }
        }
        
        setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(day); return newSet; });

    }, [loadingImages, executeImageGeneration, onImageSaved]);

    // Fix: Updated function to accept weeklyPlan and derive recipes/days from it.
    const generateMissingImages = useCallback(async (weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void): Promise<{[key:string]: string}> => {
        const recipesToGenerate = weeklyPlan
            .flatMap(dp => dp.meals.map(m => ({ recipe: m.recipe, day: dp.day })))
            .filter(({ day }) => !imageUrls[day] && !loadingImages.has(day));

        const finalUrls = { ...imageUrls };

        if (recipesToGenerate.length === 0) return finalUrls;
        
        for (let i = 0; i < recipesToGenerate.length; i++) {
            const { recipe, day } = recipesToGenerate[i];
            onProgress?.(`Generiere Bild ${i + 1}/${recipesToGenerate.length}...`);
            
            setLoadingImages(prev => new Set(prev).add(day));
            setImageErrors(prev => ({ ...prev, [day]: null }));
            
            const base64Url = await executeImageGeneration(recipe, day);
            if (base64Url) {
                try {
                    const base64Data = base64Url.split(';base64,').pop();
                    if (!base64Data) throw new Error("Konnte Bilddaten nicht extrahieren.");

                    const { imageUrl: fileUrl } = await apiService.saveRecipeImage(recipe.id, base64Data);
                    finalUrls[day] = fileUrl;
                    setImageUrls(prev => ({ ...prev, [day]: fileUrl }));
                } catch (e) {
                    console.error(`Konnte Bild für ${day} nicht speichern:`, e);
                }
            }

             setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(day); return newSet; });

            if (i < recipesToGenerate.length - 1) {
                onProgress?.(`Warte 3s...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        if (onImageSaved) onImageSaved();
        return finalUrls;

    }, [imageUrls, loadingImages, executeImageGeneration, onImageSaved]);
    
    const resetImageState = useCallback(() => {
        setImageUrls({});
        setLoadingImages(new Set());
        setImageErrors({});
    }, []);

    const setImageUrlsFromArchive = useCallback((urls: { [key: string]: string }) => {
        setImageUrls(urls);
        setLoadingImages(new Set());
        setImageErrors({});
    }, []);

    return { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState, setImageUrlsFromArchive };
};