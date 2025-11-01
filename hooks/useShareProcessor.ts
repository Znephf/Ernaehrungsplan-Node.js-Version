import { useState, useEffect, useRef, useCallback } from 'react';
import type { ArchiveEntry } from '../types';
import * as apiService from '../services/apiService';

const ACTIVE_SHARE_JOB_ID_KEY = 'activeShareJobId';

export const useShareProcessor = (onShareComplete: (updatedPlan: ArchiveEntry | null) => void) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('Teilen');
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const pollTimeoutRef = useRef<number | null>(null);

    const cleanup = useCallback(() => {
        setIsProcessing(false);
        setStatus('Teilen');
        setJobId(null);
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
        localStorage.removeItem(ACTIVE_SHARE_JOB_ID_KEY);
    }, []);

    useEffect(() => {
        // Beim ersten Laden prüfen, ob ein Job wieder aufgenommen werden muss
        const storedJobId = localStorage.getItem(ACTIVE_SHARE_JOB_ID_KEY);
        if (storedJobId) {
            console.log(`Nehme laufenden Share-Job wieder auf: ${storedJobId}`);
            setJobId(storedJobId);
            setIsProcessing(true);
        }
    }, []);

    useEffect(() => {
        if (!jobId) return;

        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;

        const poll = async () => {
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

            try {
                const { status: jobStatus, progressText, resultJson, errorMessage } = await apiService.getShareJobStatus(jobId);
                consecutiveErrors = 0; // Reset on successful poll

                if (jobStatus === 'complete' && resultJson?.shareUrl) {
                    const fullUrl = `${window.location.origin}${resultJson.shareUrl}`;
                    setShareUrl(fullUrl);
                    // Den Haupt-App-Zustand über den Abschluss informieren
                    onShareComplete(null);
                    cleanup();
                    return;
                }

                if (jobStatus === 'error') {
                    setError(`Fehler beim Teilen: ${errorMessage || 'Unbekannter Fehler'}`);
                    cleanup();
                    return;
                }

                setStatus(progressText || jobStatus);
                pollTimeoutRef.current = window.setTimeout(poll, 3000);

            } catch (pollError) {
                consecutiveErrors++;
                console.warn(`Fehler beim Abrufen des Job-Status (Versuch ${consecutiveErrors}/${maxConsecutiveErrors}):`, pollError);
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    setError('Verbindung zum Server verloren.');
                    cleanup();
                    return;
                }
                pollTimeoutRef.current = window.setTimeout(poll, 5000);
            }
        };

        poll();

        return () => {
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        };
    }, [jobId, cleanup, onShareComplete]);


    const startSharingProcess = useCallback(async (plan: ArchiveEntry) => {
        if (isProcessing) return;

        setIsProcessing(true);
        setError(null);
        setStatus('Vorgang wird gestartet...');

        try {
            const response = await apiService.startShareJob(plan.id);
            localStorage.setItem(ACTIVE_SHARE_JOB_ID_KEY, response.jobId);
            setJobId(response.jobId);
        } catch (e) {
            setError(`Job konnte nicht gestartet werden: ${(e as Error).message}`);
            cleanup();
        }
    }, [isProcessing, cleanup]);

    const cancelProcessing = useCallback(() => {
        setError("Vorgang abgebrochen.");
        cleanup();
    }, [cleanup]);

    return { isProcessing, status, shareUrl, setShareUrl, error, startSharingProcess, cancelProcessing };
};
