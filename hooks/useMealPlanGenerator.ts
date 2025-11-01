import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlanSettings, ArchiveEntry } from '../types';
import * as apiService from '../services/apiService';

const ACTIVE_JOB_ID_KEY = 'activeMealPlanJobId';

export const useMealPlanGenerator = () => {
    const [plan, setPlan] = useState<ArchiveEntry | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState<string>('idle');
    const [jobId, setJobId] = useState<string | null>(null);
    const pollTimeoutRef = useRef<number | null>(null);

    const cleanup = useCallback(() => {
        setIsLoading(false);
        setGenerationStatus('idle');
        setJobId(null);
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
        localStorage.removeItem(ACTIVE_JOB_ID_KEY);
    }, []);

    useEffect(() => {
        // Beim ersten Laden prüfen, ob ein Job wieder aufgenommen werden muss
        const storedJobId = localStorage.getItem(ACTIVE_JOB_ID_KEY);
        if (storedJobId) {
            console.log(`Nehme laufenden Job wieder auf: ${storedJobId}`);
            setJobId(storedJobId);
            setIsLoading(true);
        }
    }, []);

    useEffect(() => {
        if (!jobId) {
            return;
        }

        let totalAttempts = 0;
        const maxTotalAttempts = 120; // 10 Minuten Timeout
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 4;

        const poll = async () => {
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

            if (totalAttempts++ > maxTotalAttempts) {
                setError('Die Anfrage hat zu lange gedauert. Der Server antwortet nicht.');
                cleanup();
                return;
            }

            try {
                const { status, plan: newPlanData, error: jobError } = await apiService.getJobStatus(jobId);
                consecutiveErrors = 0;
                setGenerationStatus(status);

                if (status === 'complete') {
                    if (newPlanData) {
                        setPlan(newPlanData);
                        // Übergibt den neuen Plan an einen Callback in der Haupt-App
                        const onCompleteCallback = (window as any)._onPlanGenerated;
                        if (typeof onCompleteCallback === 'function') {
                            onCompleteCallback(newPlanData);
                        }
                    } else {
                         setError('Plan generiert, aber Daten konnten nicht geladen werden.');
                    }
                    cleanup();
                    return;
                }

                if (status === 'error') {
                    setError(`Plan konnte nicht erstellt werden: ${jobError || 'Unbekannter Serverfehler.'}`);
                    cleanup();
                    return;
                }

                pollTimeoutRef.current = window.setTimeout(poll, 5000);

            } catch (pollError) {
                consecutiveErrors++;
                console.warn(`Fehler beim Abrufen des Job-Status (Versuch ${consecutiveErrors}/${maxConsecutiveErrors}):`, pollError);
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    setError(`Verbindung zum Server verloren. Bitte prüfen Sie Ihre Internetverbindung.`);
                    cleanup();
                    return;
                }
                
                pollTimeoutRef.current = window.setTimeout(poll, 5000);
            }
        };

        poll();

        return () => {
            if (pollTimeoutRef.current) {
                clearTimeout(pollTimeoutRef.current);
            }
        };
    }, [jobId, cleanup]);

    const generateNewPlan = useCallback(async (settings: PlanSettings, onComplete: (newPlan: ArchiveEntry | null) => void) => {
        if (isLoading) return;

        setIsLoading(true);
        setError(null);
        setGenerationStatus('pending');
        
        // Speichere den Callback für den Fall eines Seiten-Reloads
        (window as any)._onPlanGenerated = onComplete;

        try {
            const response = await apiService.startPlanGenerationJob({
                settings,
                previousPlanRecipes: plan ? plan.recipes : [],
            });
            localStorage.setItem(ACTIVE_JOB_ID_KEY, response.jobId);
            setJobId(response.jobId);
        } catch (startJobError) {
            setError(`Job konnte nicht gestartet werden: ${(startJobError as Error).message}`);
            cleanup();
        }
    }, [isLoading, plan, cleanup]);
    
    const cancelGeneration = useCallback(() => {
        console.log("Generierung wird vom Benutzer abgebrochen.");
        setError("Generierung abgebrochen.");
        cleanup();
    }, [cleanup]);

    return { plan, setPlan, isLoading, error, generateNewPlan, generationStatus, cancelGeneration };
};