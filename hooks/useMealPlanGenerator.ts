
import { useState } from 'react';
import type { PlanSettings, ArchiveEntry } from '../types';
import * as apiService from '../services/apiService';

interface GenerationResult {
    success: boolean;
    newPlan: ArchiveEntry | null;
    newPlanId: string | null;
}

export const useMealPlanGenerator = () => {
    const [plan, setPlan] = useState<ArchiveEntry | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState<string>('idle');

    const generateNewPlan = async (settings: PlanSettings): Promise<GenerationResult> => {
        setIsLoading(true);
        setError(null);
        setGenerationStatus('pending');

        try {
            const { jobId } = await apiService.startPlanGenerationJob({ 
                settings,
                previousPlanRecipes: plan ? plan.recipes : [] 
            });

            return new Promise((resolve) => {
                const pollInterval = 5000;
                let attempts = 0;
                const maxAttempts = 120; // 10 Minuten Timeout

                const intervalId = setInterval(async () => {
                    if (attempts++ > maxAttempts) {
                        clearInterval(intervalId);
                        setError('Die Anfrage hat zu lange gedauert.');
                        setIsLoading(false);
                        setGenerationStatus('idle');
                        resolve({ success: false, newPlan: null, newPlanId: null });
                        return;
                    }

                    try {
                        const { status, plan: newPlanData, planId, error: jobError } = await apiService.getJobStatus(jobId);
                        setGenerationStatus(status);

                        if (status === 'complete') {
                            clearInterval(intervalId);
                            setIsLoading(false);
                            setGenerationStatus('idle');
                            if (newPlanData) {
                                resolve({ success: true, newPlan: newPlanData, newPlanId: newPlanData.id });
                            } else {
                                console.warn('Plan-Generierung erfolgreich, aber Plandaten fehlten.');
                                resolve({ success: true, newPlan: null, newPlanId: planId });
                            }
                        }

                        if (status === 'error') {
                            clearInterval(intervalId);
                            setError(`Plan konnte nicht erstellt werden: ${jobError}`);
                            setIsLoading(false);
                            setGenerationStatus('idle');
                            resolve({ success: false, newPlan: null, newPlanId: null });
                        }
                    } catch (pollError) {
                        console.warn("Fehler beim Abrufen des Job-Status:", pollError);
                    }
                }, pollInterval);
            });

        } catch (startJobError) {
            setError(`Job konnte nicht gestartet werden: ${(startJobError as Error).message}`);
            setIsLoading(false);
            setGenerationStatus('idle');
            return { success: false, newPlan: null, newPlanId: null };
        }
    };
    
    return { plan, setPlan, isLoading, error, generateNewPlan, generationStatus };
};
