import { useState, useCallback } from 'react';
import type { Recipe } from '../types';
import * as apiService from '../services/apiService';

export const useImageGenerator = (onImageSaved?: () => void) => {
    const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [key: string]: string | null }>({});
    
    // This function now returns the raw base64 data URL
    const executeImageGeneration = useCallback(async (recipe: Recipe): Promise<string | null> => {
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
        setImageErrors(prev => ({ ...prev, [recipe.day]: `Fehler: ${finalErrorMessage}` }));
        return null;
    }, []);

    const generateImage = useCallback(async (recipe: Recipe, planId: number | null) => {
        if (loadingImages.has(recipe.day) || !planId) return;

        setLoadingImages(prev => new Set(prev).add(recipe.day));
        setImageErrors(prev => ({ ...prev, [recipe.day]: null }));

        const base64ImageUrl = await executeImageGeneration(recipe);

        if (base64ImageUrl) {
            try {
                // Send the base64 to the backend, which saves it as a file and returns the file URL
                const { imageUrl: fileUrl } = await apiService.saveImageUrl(planId, recipe.day, base64ImageUrl);
                setImageUrls(prev => ({ ...prev, [recipe.day]: fileUrl }));
                if (onImageSaved) onImageSaved();
            } catch (e) {
                console.error("Konnte Bild nicht im Backend speichern:", e);
                setImageErrors(prev => ({ ...prev, [recipe.day]: `Speicherfehler: ${(e as Error).message}` }));
            }
        }
        
        setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(recipe.day); return newSet; });

    }, [loadingImages, executeImageGeneration, onImageSaved]);

    const generateMissingImages = useCallback(async (recipes: Recipe[], planId: number | null, onProgress?: (status: string) => void): Promise<{[key: string]: string}> => {
        const recipesToGenerate = recipes.filter(r => !imageUrls[r.day] && !loadingImages.has(r.day));
        const finalUrls = { ...imageUrls };

        if (recipesToGenerate.length === 0) return finalUrls;
        
        for (let i = 0; i < recipesToGenerate.length; i++) {
            const recipe = recipesToGenerate[i];
            onProgress?.(`Generiere Bild ${i + 1}/${recipesToGenerate.length}...`);
            
            setLoadingImages(prev => new Set(prev).add(recipe.day));
            setImageErrors(prev => ({ ...prev, [recipe.day]: null }));
            
            const base64Url = await executeImageGeneration(recipe);
            if (base64Url && planId) {
                try {
                    const { imageUrl: fileUrl } = await apiService.saveImageUrl(planId, recipe.day, base64Url);
                    finalUrls[recipe.day] = fileUrl;
                    setImageUrls(prev => ({ ...prev, [recipe.day]: fileUrl }));
                    if (onImageSaved) onImageSaved();
                } catch (e) {
                    console.error(`Konnte Bild für ${recipe.day} nicht speichern:`, e);
                }
            }

             setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(recipe.day); return newSet; });

            if (i < recipesToGenerate.length - 1) {
                onProgress?.(`Warte 3s...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
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