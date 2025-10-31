import { useState, useCallback } from 'react';
import type { Recipe } from '../types';

export const useImageGenerator = () => {
    const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({});
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
    const [imageErrors, setImageErrors] = useState<{ [key: string]: string | null }>({});
    
    const executeImageGeneration = useCallback(async (recipe: Recipe): Promise<string | null> => {
        const maxAttempts = 10;
        let lastKnownError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const rawApiResponse = await fetch('/api/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipe, attempt })
                });

                if (!rawApiResponse.ok) {
                    const errorData = await rawApiResponse.json();
                    throw new Error(errorData.error || `Serverfehler: ${rawApiResponse.statusText}`);
                }
                
                const { apiResponse, debug } = await rawApiResponse.json();

                console.groupCollapsed(`[DEBUG] Bild-Generierung für: "${recipe.title}"`);
                console.log('--- Gesendetes Rezept-Objekt ---');
                console.log(recipe);
                console.log(`--- Prompt (Versuch ${attempt}) ---`);
                console.log(debug.imagePrompt);
                console.groupEnd();

                if (apiResponse.promptFeedback?.blockReason) {
                    throw new Error(`Anfrage blockiert (${apiResponse.promptFeedback.blockReason})`);
                }

                const candidate = apiResponse?.candidates?.[0];
                if (!candidate) {
                    throw new Error("Keine Bild-Vorschläge von der API erhalten.");
                }

                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    if (candidate.finishReason === 'SAFETY') throw new Error("Aus Sicherheitsgründen blockiert.");
                    throw new Error(`Generierung gestoppt: ${candidate.finishReason}`);
                }

                const imagePart = candidate.content?.parts?.find((p: any) => p.inlineData);
                if (imagePart?.inlineData) {
                    const base64ImageBytes: string = imagePart.inlineData.data;
                    const url = `data:image/png;base64,${base64ImageBytes}`;
                    setImageUrls(prev => ({ ...prev, [recipe.day]: url }));
                    setLoadingImages(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(recipe.day);
                        return newSet;
                    });
                    return url;
                } else {
                    throw new Error("Antwort enthält keine Bilddaten.");
                }
            } catch (e) {
                lastKnownError = e as Error;
                console.warn(`Bildgenerierungsversuch ${attempt} für "${recipe.title}" fehlgeschlagen:`, e);
                const errorMsg = (lastKnownError.message || '').toLowerCase();
                // Stop retrying on safety blocks OR quota errors to avoid unnecessary calls
                if (errorMsg.includes('blockiert') || errorMsg.includes('sicherheit') || errorMsg.includes('quota')) {
                    break;
                }
            }
        }

        // The server now sends a user-friendly message, so we can use it directly.
        const finalErrorMessage = lastKnownError?.message || "Ein unbekannter Fehler ist aufgetreten.";
        setImageErrors(prev => ({ ...prev, [recipe.day]: `Fehler: ${finalErrorMessage}` }));
        setLoadingImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(recipe.day);
            return newSet;
        });

        return null;
    }, []);

    const generateImage = useCallback(async (recipe: Recipe) => {
        if (loadingImages.has(recipe.day)) return;

        setLoadingImages(prev => new Set(prev).add(recipe.day));
        setImageErrors(prev => ({ ...prev, [recipe.day]: null }));

        await executeImageGeneration(recipe);
    }, [loadingImages, executeImageGeneration]);

    const generateMissingImages = useCallback(async (recipes: Recipe[], onProgress?: (status: string) => void): Promise<{[key: string]: string}> => {
        const recipesToGenerate = recipes.filter(r => !imageUrls[r.day] && !loadingImages.has(r.day));
        const finalUrls = { ...imageUrls };

        if (recipesToGenerate.length === 0) {
            return finalUrls;
        }

        for (let i = 0; i < recipesToGenerate.length; i++) {
            const recipe = recipesToGenerate[i];
            if (onProgress) {
                onProgress(`Generiere Bild ${i + 1} von ${recipesToGenerate.length}...`);
            }
            
            setLoadingImages(prev => new Set(prev).add(recipe.day));
            setImageErrors(prev => ({ ...prev, [recipe.day]: null }));
            
            const newUrl = await executeImageGeneration(recipe);
            if (newUrl) {
                finalUrls[recipe.day] = newUrl;
            }

            // Add delay if it's not the last image
            if (i < recipesToGenerate.length - 1) {
                if (onProgress) {
                   onProgress(`Warte 3s...`);
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        return finalUrls;
    }, [imageUrls, loadingImages, executeImageGeneration]);
    
    const resetImageState = useCallback(() => {
        setImageUrls({});
        setLoadingImages(new Set());
        setImageErrors({});
    }, []);

    return { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState };
};