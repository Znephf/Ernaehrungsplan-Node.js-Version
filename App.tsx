// Fix: Implemented the main App component to manage state, authentication, and orchestrate different views.
import React, { useState, useEffect, useCallback } from 'react';
import type { View, PlanSettings, ArchiveEntry, WeeklyPlan, Recipe } from './types';
import * as apiService from './services/apiService';

import Header from './components/Header';
import MainContent from './components/MainContent';
import LoginComponent from './components/Login';
import LoadingOverlay from './components/LoadingOverlay';
import ShareModal from './components/ShareModal';

import { useArchive } from './hooks/useArchive';
import { useMealPlanGenerator } from './hooks/useMealPlanGenerator';
import { useImageGenerator } from './hooks/useImageGenerator';
import { useShareProcessor } from './hooks/useShareProcessor';

const initialSettings: PlanSettings = {
    persons: 2,
    kcal: 2000,
    dietaryPreference: 'omnivore',
    dietType: 'balanced',
    dishComplexity: 'simple',
    excludedIngredients: '',
    desiredIngredients: '',
    isGlutenFree: false,
    isLactoseFree: false,
    includedMeals: ['breakfast', 'dinner']
};

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [currentView, setCurrentView] = useState<View>('plan');
    
    // Hooks for different functionalities
    const { archive, loadPlanFromArchive, fetchArchive } = useArchive();
    const { 
        plan: generatedPlan, 
        isLoading: isGenerating, 
        error: generationError, 
        generateNewPlan, 
        generationStatus,
        cancelGeneration
    } = useMealPlanGenerator();
    
    const { 
        imageUrls, 
        loadingImages, 
        imageErrors, 
        generateImage, 
        generateMissingImages, 
        resetImageState, 
        setImageUrlsFromArchive 
    } = useImageGenerator(fetchArchive);
    
    const onShareComplete = () => {
        // After sharing, the shareId is updated in the DB. Refetch to get the latest state.
        fetchArchive();
    };
    const { isProcessing: isSharing, status: shareStatus, shareUrl, setShareUrl, error: shareError, startSharingProcess } = useShareProcessor(onShareComplete);

    const [settings, setSettings] = useState<PlanSettings>(initialSettings);
    
    // This is the currently displayed plan, which could be from generation, archive, or default.
    const [activePlan, setActivePlan] = useState<ArchiveEntry | null>(null);


    // --- Authentication ---
    useEffect(() => {
        apiService.checkAuth()
            .then(() => setIsLoggedIn(true))
            .catch(() => setIsLoggedIn(false));
    }, []);

    const handleLoginSuccess = () => {
        setIsLoggedIn(true);
    };
    
    const handleLogout = async () => {
        await apiService.logout();
        setIsLoggedIn(false);
    };

    // --- Data Loading and Plan Management ---
    useEffect(() => {
        if (isLoggedIn) {
            fetchArchive();
        }
    }, [isLoggedIn, fetchArchive]);

    // This effect handles the result of a NEWLY generated plan
    useEffect(() => {
        if (generatedPlan) {
            setActivePlan(generatedPlan);
            setSettings(generatedPlan.settings);
            setCurrentView('plan');
            // After generation, refetch archive to include the new plan
            fetchArchive();
            // set image urls from new plan
            const newImageUrls: { [id: number]: string } = {};
            generatedPlan.recipes.forEach(r => {
                if (r.image_url) {
                    newImageUrls[r.id] = r.image_url;
                }
            });
            setImageUrlsFromArchive(newImageUrls);
        }
    }, [generatedPlan, fetchArchive, setImageUrlsFromArchive]);
    
    const handleGeneratePlan = () => {
        generateNewPlan(settings);
    };

    // This handler handles LOADING an EXISTING plan from the archive
    const handleLoadPlan = useCallback((id: number) => {
        const planToLoad = loadPlanFromArchive(id);
        if (planToLoad) {
            resetImageState();
            setActivePlan(planToLoad);
            setSettings(planToLoad.settings);

            const loadedImageUrls: { [id: number]: string } = {};
            planToLoad.recipes.forEach(recipe => {
                if (recipe.image_url) {
                    loadedImageUrls[recipe.id] = recipe.image_url;
                }
            });
            setImageUrlsFromArchive(loadedImageUrls);

            setCurrentView('plan');
        }
    }, [loadPlanFromArchive, resetImageState, setImageUrlsFromArchive]);
    
    const handlePlanSaved = () => {
        fetchArchive();
        setCurrentView('archive');
    };

    // --- UI Navigation ---
    const handleSelectRecipe = (day: string) => {
        setCurrentView('recipes');
        // Logic to scroll to the recipe can be added in RecipesComponent
        setTimeout(() => {
            const element = document.getElementById(`recipe-${day}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handleShowPlanner = () => {
        setActivePlan(null);
        setSettings(initialSettings);
        setCurrentView('plan');
    };
    
    // --- Sharing ---
    const handleShare = () => {
        if (activePlan) {
            if (activePlan.shareId) {
                setShareUrl(`${window.location.origin}/shares/${activePlan.shareId}.html`);
            } else {
                startSharingProcess(activePlan);
            }
        }
    };


    if (isLoggedIn === null) {
        return <div className="flex h-screen items-center justify-center">Lade...</div>;
    }
    if (!isLoggedIn) {
        return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="bg-slate-100 min-h-screen">
            <Header
                currentView={currentView}
                onSetView={setCurrentView}
                planExists={!!activePlan}
                isSharing={isSharing}
                shareStatus={shareStatus}
                onShare={handleShare}
                onLogout={handleLogout}
                onShowPlanner={handleShowPlanner}
            />
            
            {(isGenerating) && (
                <LoadingOverlay status={generationStatus} onCancel={cancelGeneration} />
            )}

            {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}
            
            {generationError && <div className="container mx-auto p-4"><div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{generationError}</p></div></div>}
            {shareError && <div className="container mx-auto p-4"><div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{shareError}</p></div></div>}

            <MainContent
                currentView={currentView}
                onSetView={setCurrentView}
                plan={activePlan}
                settings={settings}
                archive={archive}
                imageUrls={imageUrls}
                loadingImages={loadingImages}
                imageErrors={imageErrors}
                isLoading={isGenerating}
                onSettingsChange={setSettings}
                onGeneratePlan={handleGeneratePlan}
                onLoadPlan={handleLoadPlan}
                onSelectRecipe={handleSelectRecipe}
                onPlanSaved={handlePlanSaved}
                generateImage={generateImage}
                generateMissingImages={(weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void): Promise<{ [key: string]: string; }> => generateMissingImages(weeklyPlan, activePlan?.id || null, onProgress)}
            />
        </div>
    );
};

export default App;