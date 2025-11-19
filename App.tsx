// Fix: Implemented the main App component to manage state, authentication, and orchestrate different views.
import React, { useState, useEffect, useCallback } from 'react';
import type { View, PlanSettings, ArchiveEntry, WeeklyPlan, Recipe, MealCategory } from './types';
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
    creativeInspiration: '',
    isGlutenFree: false,
    isLactoseFree: false,
    includedMeals: ['breakfast', 'dinner'],
    useSameBreakfast: false,
    customBreakfastText: '',
    selectedBreakfastRecipeId: null,
    useSameSnack: false,
    customSnackText: '',
    selectedSnackRecipeId: null,
    useSameCoffee: false,
    customCoffeeText: '',
    selectedCoffeeRecipeId: null,
};

const App: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [currentView, setCurrentView] = useState<View>('plan');
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [shareLoadError, setShareLoadError] = useState(false);
    
    // Hooks for different functionalities
    const { archive, loadPlanFromArchive, fetchArchive, removePlan } = useArchive();
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

    const [isBulkImageGenerating, setIsBulkImageGenerating] = useState(false);
    const [bulkImageStatus, setBulkImageStatus] = useState('');

    // --- Share Link Safety Check & Auto-Repair ---
    useEffect(() => {
        // Wenn die App unter /shares/ geladen wird, ist das falsch.
        // Das bedeutet, ein Service Worker oder Browser-Cache hat die React-App (index.html)
        // ausgeliefert statt der statischen Datei vom Server.
        if (window.location.pathname.startsWith('/shares/')) {
            console.warn("React App loaded on /shares/ path. This indicates a caching issue. Attempting auto-repair...");

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    if (registrations.length > 0) {
                        console.log("Stale Service Worker found. Unregistering and reloading...");
                        Promise.all(registrations.map(r => r.unregister())).then(() => {
                            // Hartes Neuladen erzwingen, um Cache zu umgehen
                            window.location.reload();
                        });
                    } else {
                        // Kein SW, aber trotzdem hier? Dann ist es wahrscheinlich ein alter Browser-Cache
                        // oder die Datei existiert wirklich nicht.
                        setShareLoadError(true);
                    }
                });
            } else {
                setShareLoadError(true);
            }
        }
    }, []);

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
            apiService.getAllRecipes()
                .then(setAllRecipes)
                .catch(err => console.error("Could not fetch all recipes for planner:", err));
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
            const newImageUrls: { [id: number]: { full: string; thumb: string; } } = {};
            generatedPlan.recipes.forEach(r => {
                if (r.image_url && r.thumbnail_url) {
                    newImageUrls[r.id] = { full: r.image_url, thumb: r.thumbnail_url };
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

            const loadedImageUrls: { [id: number]: { full: string; thumb: string; } } = {};
            planToLoad.recipes.forEach(recipe => {
                if (recipe.image_url && recipe.thumbnail_url) {
                    loadedImageUrls[recipe.id] = { full: recipe.image_url, thumb: recipe.thumbnail_url };
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

    const handleDeletePlan = async (id: number) => {
        if (window.confirm('Möchten Sie diesen Plan wirklich unwiderruflich löschen? Die Rezepte bleiben im Rezepte-Archiv erhalten.')) {
            try {
                await apiService.deletePlan(id);
                removePlan(id); // Update local state for instant UI feedback
                if (activePlan?.id === id) {
                    setActivePlan(null); // Clear active plan if it was the one deleted
                }
            } catch (error) {
                console.error("Fehler beim Löschen des Plans:", error);
                alert("Der Plan konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut.");
            }
        }
    };
    
    const handleGenerateAllImages = async () => {
        if (!activePlan) return;
        setIsBulkImageGenerating(true);
        setBulkImageStatus('Starte... 0%');
        try {
            await generateMissingImages(activePlan.weeklyPlan, activePlan.id, setBulkImageStatus);
        } catch (error) {
            console.error("Fehler bei der Massen-Bilderstellung:", error);
            setBulkImageStatus('Ein Fehler ist aufgetreten.');
        } finally {
            setIsBulkImageGenerating(false);
        }
    };

    const cancelBulkImageGeneration = () => {
        setIsBulkImageGenerating(false);
    };


    // --- UI Navigation ---
    const handleSelectRecipe = (day: string, mealType: MealCategory) => {
        setCurrentView('recipes');
        // Logic to scroll to the recipe can be added in RecipesComponent
        setTimeout(() => {
            const element = document.getElementById(`recipe-${day}-${mealType}`);
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

    if (shareLoadError) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-md text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Plan nicht gefunden</h1>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">
                        Der gewünschte Plan konnte nicht geladen werden. Dies kann passieren, wenn der Link abgelaufen ist oder der Cache ihres Browsers veraltet ist.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors"
                    >
                        Seite neu laden
                    </button>
                </div>
            </div>
        );
    }

    if (isLoggedIn === null) {
        return <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 dark:text-white">Lade...</div>;
    }
    if (!isLoggedIn) {
        return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen transition-colors duration-300">
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

            {isBulkImageGenerating && (
                <LoadingOverlay status={bulkImageStatus} onCancel={cancelBulkImageGeneration} />
            )}

            {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}
            
            {generationError && <div className="container mx-auto p-4"><div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 dark:bg-red-900 dark:text-red-200 dark:border-red-700" role="alert"><p>{generationError}</p></div></div>}
            {shareError && <div className="container mx-auto p-4"><div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 dark:bg-red-900 dark:text-red-200 dark:border-red-700" role="alert"><p>{shareError}</p></div></div>}

            <MainContent
                currentView={currentView}
                onSetView={setCurrentView}
                plan={activePlan}
                settings={settings}
                allRecipes={allRecipes}
                archive={archive}
                imageUrls={imageUrls}
                loadingImages={loadingImages}
                imageErrors={imageErrors}
                isLoading={isGenerating}
                onSettingsChange={setSettings}
                onGeneratePlan={handleGeneratePlan}
                onLoadPlan={handleLoadPlan}
                onDeletePlan={handleDeletePlan}
                onSelectRecipe={handleSelectRecipe}
                onPlanSaved={handlePlanSaved}
                generateImage={generateImage}
                isBulkImageGenerating={isBulkImageGenerating}
                onGenerateAllImages={handleGenerateAllImages}
                generateMissingImages={(weeklyPlan: WeeklyPlan, planId: number | null, onProgress?: (status: string) => void): Promise<{ [key: number]: { full: string; thumb: string; } }> => generateMissingImages(weeklyPlan, activePlan?.id || null, onProgress)}
            />
        </div>
    );
};

export default App;