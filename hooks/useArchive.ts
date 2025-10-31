import { useState, useEffect, useCallback } from 'react';
import type { ArchiveEntry } from '../types';

export const useArchive = () => {
    const [archive, setArchive] = useState<ArchiveEntry[]>([]);

    const fetchArchive = useCallback(async () => {
        try {
            const response = await fetch('/api/archive');
            if (!response.ok) {
                throw new Error('Fehler beim Laden des Archivs');
            }
            const data = await response.json();
            setArchive(data);
        } catch (error) {
            console.error("Konnte Archiv nicht vom Server laden.", error);
            // Optional: Set an error state to show in the UI
        }
    }, []);

    // Lade das Archiv initial, wenn die Komponente gemountet wird
    useEffect(() => {
        fetchArchive();
    }, [fetchArchive]);
    
    const deletePlanFromArchive = useCallback(async (id: string) => {
        if (window.confirm("Diesen Plan wirklich aus dem Archiv löschen?")) {
            try {
                const response = await fetch(`/api/archive/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    throw new Error('Fehler beim Löschen des Plans');
                }
                // Lade das Archiv neu, um die Änderungen zu übernehmen
                fetchArchive();
            } catch (error) {
                 console.error("Konnte Plan nicht aus dem Archiv löschen.", error);
                 alert("Der Plan konnte nicht gelöscht werden.");
            }
        }
    }, [fetchArchive]);

    const loadPlanFromArchive = useCallback((id: string): ArchiveEntry | null => {
        const planToLoad = archive.find(entry => entry.id === id);
        if (planToLoad) {
            return planToLoad;
        }
        return null;
    }, [archive]);
    
    return { archive, deletePlanFromArchive, loadPlanFromArchive, fetchArchive };
};
