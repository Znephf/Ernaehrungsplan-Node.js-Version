import { useState, useCallback } from 'react';
import type { ArchiveEntry } from '../types';
import * as apiService from '../services/apiService';

export const useArchive = () => {
    const [archive, setArchive] = useState<ArchiveEntry[]>([]);

    const fetchArchive = useCallback(async () => {
        try {
            const data = await apiService.getArchive();
            setArchive(data);
        } catch (error) {
            console.error("Konnte Archiv nicht vom Server laden.", error);
        }
    }, []);
    
    const deletePlanFromArchive = useCallback(async (id: number) => {
        if (window.confirm("Diesen Plan wirklich aus dem Archiv löschen?")) {
            try {
                await apiService.deletePlan(id);
                fetchArchive();
            } catch (error) {
                 console.error("Konnte Plan nicht aus dem Archiv löschen.", error);
                 alert("Der Plan konnte nicht gelöscht werden.");
            }
        }
    }, [fetchArchive]);

    const loadPlanFromArchive = useCallback((id: number): ArchiveEntry | null => {
        return archive.find(entry => entry.id === id) || null;
    }, [archive]);
    
    const updatePlanInArchive = useCallback((updatedPlan: ArchiveEntry) => {
        setArchive(prevArchive =>
            prevArchive.map(entry =>
                entry.id === updatedPlan.id ? updatedPlan : entry
            )
        );
    }, []);

    return { archive, deletePlanFromArchive, loadPlanFromArchive, fetchArchive, updatePlanInArchive };
};