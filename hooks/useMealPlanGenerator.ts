import { useState } from 'react';
import type { PlanSettings, ArchiveEntry, PlanData } from '../types';

interface GenerationResult {
    success: boolean;
    newPlan: ArchiveEntry | null;
    newPlanId: string | null;
}

export const useMealPlanGenerator = () => {
    const [plan, setPlan] = useState<PlanData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState<string>('idle');

    const generateNewPlan = async (settings: PlanSettings): Promise<GenerationResult> => {
        setIsLoading(true);
        setError(null);
        setGenerationStatus('pending');

        try {
            const jobResponse = await fetch('/api/generate-plan-job', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    settings,
                    previousPlanRecipes: plan ? plan.recipes : [] 
                }),
            });

            if (!jobResponse.ok) {
                const errorData = await jobResponse.json();
                throw new Error(errorData.error || `Serverfehler: ${jobResponse.statusText}`);
            }

            const { jobId } = await jobResponse.json();

            return new Promise((resolve) => {
                const pollInterval = 5000; // 5 Sekunden
                let attempts = 0;
                const maxAttempts = (10 * 60 * 1000) / pollInterval; // 10 Minuten Timeout

                const intervalId = setInterval(async () => {
                    if (attempts++ > maxAttempts) {
                        clearInterval(intervalId);
                        setError('Die Anfrage hat zu lange gedauert und wurde abgebrochen.');
                        setIsLoading(false);
                        setGenerationStatus('idle');
                        resolve({ success: false, newPlan: null, newPlanId: null });
                        return;
                    }

                    try {
                        const statusResponse = await fetch(`/api/job-status/${jobId}`);
                        if (!statusResponse.ok) {
                           console.warn(`Job-Status-Abfrage fehlgeschlagen: ${statusResponse.status}`);
                           return; 
                        }

                        const { status, plan: newPlanData, planId, error: jobError } = await statusResponse.json();
                        setGenerationStatus(status);

                        if (status === 'complete') {
                            clearInterval(intervalId);
                            setIsLoading(false);
                            setGenerationStatus('idle');
                            if (newPlanData) {
                                resolve({ success: true, newPlan: newPlanData, newPlanId: newPlanData.id });
                            } else {
                                console.warn('Plan-Generierung erfolgreich, aber Plandaten fehlten. Refetch wird benötigt.');
                                resolve({ success: true, newPlan: null, newPlanId: planId });
                            }
                        }

                        if (status === 'error') {
                            clearInterval(intervalId);
                            setError(`Der Ernährungsplan konnte nicht erstellt werden: ${jobError}`);
                            setIsLoading(false);
                            setGenerationStatus('idle');
                            resolve({ success: false, newPlan: null, newPlanId: null });
                        }
                    } catch (pollError) {
                        console.warn("Netzwerkfehler beim Abrufen des Job-Status:", pollError);
                    }
                }, pollInterval);
            });

        } catch (startJobError) {
            setError(`Der Generierungs-Job konnte nicht gestartet werden: ${(startJobError as Error).message}`);
            setIsLoading(false);
            setGenerationStatus('idle');
            return { success: false, newPlan: null, newPlanId: null };
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

    return { plan, setPlan: setPlanFromArchive, isLoading, error, generateNewPlan, generationStatus };
};