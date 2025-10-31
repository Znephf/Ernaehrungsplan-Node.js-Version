import { useState, useEffect, useCallback } from 'react';
import type { ArchiveEntry } from '../types';

export const useArchive = () => {
    // Initialize state from localStorage, or with an empty array if not found/invalid.
    // This runs only once on component mount.
    const [archive, setArchive] = useState<ArchiveEntry[]>(() => {
        try {
            const savedArchive = localStorage.getItem('ernaehrungsplan-archiv');
            return savedArchive ? JSON.parse(savedArchive) : [];
        } catch (error) {
            console.error("Konnte Archiv nicht aus localStorage laden.", error);
            return [];
        }
    });

    // This effect runs whenever the 'archive' state changes, saving it to localStorage.
    // This makes the persistence logic more robust and declarative.
    useEffect(() => {
        try {
            localStorage.setItem('ernaehrungsplan-archiv', JSON.stringify(archive));
        } catch (error) {
            console.error("Konnte Archiv nicht in localStorage speichern.", error);
        }
    }, [archive]);
    
    const addPlanToArchive = useCallback((newEntry: Omit<ArchiveEntry, 'id' | 'createdAt'>) => {
        const entryWithMetadata: ArchiveEntry = {
            ...newEntry,
            id: Date.now().toString(),
            createdAt: new Date().toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        };
        // Simply update the state; the useEffect will handle saving to localStorage.
        setArchive(prevArchive => [entryWithMetadata, ...prevArchive]);
    }, []);

    const deletePlanFromArchive = useCallback((id: string) => {
        if (window.confirm("Diesen Plan wirklich aus dem Archiv löschen?")) {
            // Simply update the state; the useEffect will handle saving to localStorage.
            setArchive(prevArchive => prevArchive.filter(entry => entry.id !== id));
        }
    }, []);

    const loadPlanFromArchive = useCallback((id: string): ArchiveEntry | null => {
        const planToLoad = archive.find(entry => entry.id === id);
        if (planToLoad) {
            return planToLoad;
        }
        return null;
    }, [archive]); // Dependency on 'archive' ensures this function has the latest data.
    
    return { archive, addPlanToArchive, deletePlanFromArchive, loadPlanFromArchive };
};