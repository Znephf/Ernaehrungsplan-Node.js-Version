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

    const removePlan = useCallback((id: number) => {
        setArchive(prev => prev.filter(entry => entry.id !== id));
    }, []);

    return { archive, loadPlanFromArchive, fetchArchive, updatePlanInArchive, removePlan };
};