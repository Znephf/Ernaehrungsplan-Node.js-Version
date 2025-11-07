import { useState, useCallback } from 'react';
import type { Recipe, WeeklyPlan } from '../types';
import * as apiService from '../services/apiService';

export const useImageGenerator = (onImageSaved?: () => void) => {
    const [imageUrls, setImageUrls] = useState<{ [id: number]: string }>({});
    const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [id: number]: string | null }>({});
    
    const executeImageGeneration = useCallback(async (recipe: Recipe): Promise<string | null> => {
        const maxAttempts = 5;
        let lastKnownError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { apiResponse, debug } = await apiService.generateImage(recipe, attempt);

                if (debug.keyUsed) {
                    const keyName = debug.keyUsed === 'primary' ? 'API_KEY' : 'API_KEY_FALLBACK';
                    console.log(`[API-Info] Bild für "${recipe.title}" wurde mit ${keyName} generiert (Versuch ${attempt}).`);
                }

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
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        const finalErrorMessage = lastKnownError?.message || "Unbekannter Fehler.";
        setImageErrors(prev => ({ ...prev, [recipe.id]: `Fehler: ${finalErrorMessage}` }));
        return null;
    }, []);

    const generateImage = useCallback(async (recipe: Recipe) => {
        if (loadingImages.has(recipe.id)) return;

        setLoadingImages(prev => new Set(prev).add(recipe.id));
        setImageErrors(prev => ({ ...prev, [recipe.id]: null }));

        const base64ImageUrl = await executeImageGeneration(recipe);

        if (base64ImageUrl) {
            try {
                const base64Data = base64ImageUrl.split(';base64,').pop();
                if (!base64Data) throw new Error("Konnte Bilddaten nicht extrahieren.");
                
                const { imageUrl: fileUrl } = await apiService.saveRecipeImage(recipe.id, base64Data);
                
                setImageUrls(prev => ({ ...prev, [recipe.id]: fileUrl }));
                
                if (onImageSaved) onImageSaved();

            } catch (e) {
                console.error("Konnte Bild nicht im Backend speichern:", e);
                setImageErrors(prev => ({ ...prev, [recipe.id]: `Speicherfehler: ${(e as Error).message}` }));
            }
        }
        
        setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(recipe.id); return newSet; });

    }, [loadingImages, executeImageGeneration, onImageSaved]);

    const generateMissingImages = useCallback(async (weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void): Promise<{ [id: number]: string }> => {
        const recipesToGenerate = weeklyPlan
            .flatMap(dp => dp.meals.map(m => m.recipe))
            .filter(recipe => recipe && !imageUrls[recipe.id] && !loadingImages.has(recipe.id));

        const finalUrls = { ...imageUrls };

        if (recipesToGenerate.length === 0) {
            onProgress?.('Alle Bilder bereits vorhanden.');
            return finalUrls;
        }
        
        for (let i = 0; i < recipesToGenerate.length; i++) {
            const recipe = recipesToGenerate[i];
            onProgress?.(`Generiere Bild ${i + 1}/${recipesToGenerate.length}...`);
            
            setLoadingImages(prev => new Set(prev).add(recipe.id));
            setImageErrors(prev => ({ ...prev, [recipe.id]: null }));
            
            const base64Url = await executeImageGeneration(recipe);
            if (base64Url) {
                try {
                    const base64Data = base64Url.split(';base64,').pop();
                    if (!base64Data) throw new Error("Konnte Bilddaten nicht extrahieren.");

                    const { imageUrl: fileUrl } = await apiService.saveRecipeImage(recipe.id, base64Data);
                    finalUrls[recipe.id] = fileUrl;
                    setImageUrls(prev => ({ ...prev, [recipe.id]: fileUrl }));
                } catch (e) {
                    console.error(`Konnte Bild für Rezept ${recipe.id} nicht speichern:`, e);
                }
            }

             setLoadingImages(prev => { const newSet = new Set(prev); newSet.delete(recipe.id); return newSet; });

            if (i < recipesToGenerate.length - 1) {
                onProgress?.(`Warte 3s...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        onProgress?.('Fertig!');
        if (onImageSaved) onImageSaved();
        return finalUrls;

    }, [imageUrls, loadingImages, executeImageGeneration, onImageSaved]);
    
    const resetImageState = useCallback(() => {
        setImageUrls({});
        setLoadingImages(new Set());
        setImageErrors({});
    }, []);

    const setImageUrlsFromArchive = useCallback((urls: { [id: number]: string }) => {
        setImageUrls(urls);
        setLoadingImages(new Set());
        setImageErrors({});
    }, []);

    return { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState, setImageUrlsFromArchive };
};