import React, { useState, useEffect, useCallback } from 'react';
import type { View, ArchiveEntry, PlanSettings, Recipe } from './types';
import * as apiService from './services/apiService';

import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import MainContent from './components/MainContent';
import LoadingOverlay from './components/LoadingOverlay';
import LoginComponent from './components/Login';
import ShareModal from './components/ShareModal';

import { useMealPlanGenerator } from './hooks/useMealPlanGenerator';
import { useArchive } from './hooks/useArchive';
import { useImageGenerator } from './hooks/useImageGenerator';
import { useShareProcessor } from './hooks/useShareProcessor';

const initialSettings: PlanSettings = {
  persons: 2,
  kcal: 2000,
  dietaryPreference: 'vegetarian',
  dietType: 'low-carb',
  dishComplexity: 'simple',
  excludedIngredients: '',
  desiredIngredients: '',
  isGlutenFree: false,
  isLactoseFree: false,
  breakfastOption: 'quark',
  customBreakfast: ''
};

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [currentView, setCurrentView] = useState<View>('plan');
    const [settings, setSettings] = useState<PlanSettings>(initialSettings);

    const { 
        plan: currentPlan, 
        setPlan: setCurrentPlan, 
        isLoading: isGenerating, 
        error: generationError, 
        generateNewPlan, 
        generationStatus, 
        cancelGeneration 
    } = useMealPlanGenerator();
    
    const { archive, fetchArchive, loadPlanFromArchive, updatePlanInArchive } = useArchive();

    const handleShareComplete = useCallback((updatedPlan: ArchiveEntry | null) => {
        if (updatedPlan) {
            updatePlanInArchive(updatedPlan);
        }
        fetchArchive();
    }, [updatePlanInArchive, fetchArchive]);

    const { isProcessing: isSharing, status: shareStatus, shareUrl, setShareUrl, startSharingProcess } = useShareProcessor(handleShareComplete);

    const updatePlanAndArchive = useCallback((plan: ArchiveEntry) => {
        setCurrentPlan(plan);
        updatePlanInArchive(plan);
    }, [setCurrentPlan, updatePlanInArchive]);
    
    const { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageStateForNewPlan } = useImageGenerator(currentPlan, updatePlanAndArchive);


    useEffect(() => {
        apiService.checkAuth()
            .then(() => {
                setIsAuthenticated(true);
                fetchArchive();
            })
            .catch(() => setIsAuthenticated(false));
    }, [fetchArchive]);

    const handleLoadPlan = (id: number) => {
        const planToLoad = loadPlanFromArchive(id);
        if (planToLoad) {
            setCurrentPlan(planToLoad);
            setSettings({
                persons: planToLoad.persons,
                kcal: planToLoad.kcal,
                dietaryPreference: planToLoad.dietaryPreference,
                dietType: planToLoad.dietType,
                dishComplexity: planToLoad.dishComplexity,
                excludedIngredients: planToLoad.excludedIngredients,
                desiredIngredients: planToLoad.desiredIngredients,
                isGlutenFree: planToLoad.isGlutenFree,
                isLactoseFree: planToLoad.isLactoseFree,
                breakfastOption: planToLoad.breakfastOption,
                customBreakfast: planToLoad.customBreakfast
            });
            resetImageStateForNewPlan(planToLoad);
            setCurrentView('plan');
        }
    };

    const handleGeneratePlan = () => {
        generateNewPlan(settings, (newPlan) => {
            if (newPlan) {
                setCurrentPlan(newPlan);
                fetchArchive();
                resetImageStateForNewPlan(newPlan);
                setCurrentView('plan');
            }
        });
    };

    const handleSelectRecipe = (day: string) => {
        setCurrentView('recipes');
        setTimeout(() => {
            const recipeElement = document.getElementById(`recipe-${day}`);
            if (recipeElement) {
                recipeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const handleLogout = async () => {
        await apiService.logout();
        setIsAuthenticated(false);
    };

    const handleShare = () => {
        if (currentPlan) {
            startSharingProcess(currentPlan);
        }
    };

    if (isAuthenticated === null) {
        return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p>Lade...</p></div>;
    }
    if (!isAuthenticated) {
        return <LoginComponent onLoginSuccess={() => {
          setIsAuthenticated(true);
          fetchArchive();
        }} />;
    }

    return (
        <div className="min-h-screen bg-slate-100">
            {isGenerating && <LoadingOverlay status={generationStatus} onCancel={cancelGeneration} />}
            {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}

            <Header 
                currentView={currentView}
                onSetView={setCurrentView}
                planExists={!!currentPlan}
                isSharing={isSharing}
                shareStatus={shareStatus}
                onShare={handleShare}
                onLogout={handleLogout}
            />

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {currentView !== 'archive' && currentView !== 'planner' && (
                    <div className="bg-white/50 p-6 rounded-lg shadow-sm mb-8">
                         <h2 className="text-2xl font-bold text-slate-700 mb-4">Wochenplan konfigurieren</h2>
                        <SettingsPanel 
                            settings={settings}
                            onSettingsChange={setSettings}
                            onGeneratePlan={handleGeneratePlan}
                            isLoading={isGenerating}
                        />
                         {generationError && <p className="text-red-500 mt-4">{generationError}</p>}
                    </div>
                )}
                
                <MainContent
                    view={currentView}
                    plan={currentPlan}
                    archive={archive}
                    imageUrls={imageUrls}
                    loadingImages={loadingImages}
                    imageErrors={imageErrors}
                    onSelectRecipe={handleSelectRecipe}
                    onLoadPlan={handleLoadPlan}
                    onGenerateImage={(recipe: Recipe, planId: number | null) => generateImage(recipe, planId)}
                    onGenerateMissingImages={generateMissingImages}
                    onCustomPlanSaved={() => {
                        fetchArchive();
                        setCurrentView('archive');
                    }}
                />
            </main>
        </div>
    );
};

export default App;
