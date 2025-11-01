import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import MainContent from './components/MainContent';
import SettingsPanel from './components/SettingsPanel';
import LoadingOverlay from './components/LoadingOverlay';
import LoginComponent from './components/Login';
import ShareModal from './components/ShareModal';
import { ChevronUpIcon, ChevronDownIcon } from './components/IconComponents';
import type { View, PlanSettings, ArchiveEntry } from './types';
import { useArchive } from './hooks/useArchive';
import { useMealPlanGenerator } from './hooks/useMealPlanGenerator';
import { useImageGenerator } from './hooks/useImageGenerator';
import { useShareProcessor } from './hooks/useShareProcessor';
import { generateAndDownloadHtml } from './services/htmlExporter';
import * as apiService from './services/apiService';

const defaultSettings: PlanSettings = {
    persons: 2,
    kcal: 2000,
    dietaryPreference: 'omnivore',
    dietType: 'balanced',
    dishComplexity: 'simple',
    excludedIngredients: '',
    desiredIngredients: '',
    isGlutenFree: false,
    isLactoseFree: false,
    breakfastOption: 'quark',
    customBreakfast: '',
};

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [currentView, setCurrentView] = useState<View>('plan');
    const [selectedRecipeDay, setSelectedRecipeDay] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(true);
    const [panelSettings, setPanelSettings] = useState<PlanSettings>(defaultSettings);
    
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('Speichern');

    const { archive, deletePlanFromArchive, loadPlanFromArchive, fetchArchive, updatePlanInArchive } = useArchive();
    const { 
        plan, 
        setPlan, 
        isLoading: isGeneratingPlan, 
        error: planError, 
        generateNewPlan, 
        generationStatus,
        cancelGeneration 
    } = useMealPlanGenerator();

    const handleShareComplete = useCallback(async () => {
        // Nach Abschluss des Share-Prozesses das Archiv neu laden,
        // um den aktualisierten Plan mit shareId und neuen Bild-URLs zu erhalten.
        await fetchArchive();
    }, [fetchArchive]);
    
    const { 
        isProcessing: isSharing, 
        status: shareStatus, 
        shareUrl, 
        setShareUrl,
        error: shareError,
        startSharingProcess, 
        cancelProcessing: cancelSharing 
    } = useShareProcessor(handleShareComplete);

    const { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState, setImageUrlsFromArchive } = useImageGenerator(fetchArchive);
    
    useEffect(() => {
        const initializeApp = async () => {
            setIsAuthLoading(true);
            try {
                await apiService.checkAuth();
                setIsAuthenticated(true);
                await fetchArchive();
            } catch (error) {
                console.error("Nicht authentifiziert oder Initialisierungsfehler.");
                setIsAuthenticated(false);
            } finally {
                setIsAuthLoading(false);
            }
        };
        initializeApp();
    }, [fetchArchive]);
    
    const handleLoginSuccess = useCallback(() => {
        setIsAuthenticated(true);
        fetchArchive();
    }, [fetchArchive]);

    const handleLoadPlan = useCallback((id: number) => {
        const planToLoad = loadPlanFromArchive(id);
        if (planToLoad) {
            setPlan(planToLoad);
            setImageUrlsFromArchive(planToLoad.imageUrls || {});
            setCurrentView('plan');
            window.scrollTo(0, 0);
        }
    }, [loadPlanFromArchive, setPlan, setImageUrlsFromArchive]);

    const handleGenerateRequest = async () => {
        generateNewPlan(panelSettings, (newPlan) => {
            if (newPlan) {
                setPlan(newPlan);
                setImageUrlsFromArchive(newPlan.imageUrls || {});
                setCurrentView('plan');
                window.scrollTo(0, 0);
                fetchArchive(); 
            } else {
                 console.warn("Ein neuer Plan wurde generiert, aber die Daten konnten nicht direkt geladen werden. Ein erneutes Laden aus dem Archiv ist erforderlich.");
                 fetchArchive().then(() => {
                    // Hier könnte man versuchen, den neuesten Plan zu laden
                 });
            }
        });
    };
    

    const handleSelectRecipe = (day: string) => {
        setSelectedRecipeDay(day);
        setCurrentView('recipes');
    };
    
    const handleSetView = useCallback((view: View) => {
        if (view === 'archive') {
            fetchArchive();
        }
        setCurrentView(view);
    }, [fetchArchive]);

    useEffect(() => {
        if (currentView === 'recipes' && selectedRecipeDay) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`recipe-${selectedRecipeDay}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setSelectedRecipeDay(null);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentView, selectedRecipeDay]);

    const handleDownload = async () => {
        if (!plan || isDownloading) return;
        setIsDownloading(true);
        setDownloadStatus('Prüfe Bilder...');
        const finalImageUrls = await generateMissingImages(plan.recipes, plan.id, setDownloadStatus);
        setDownloadStatus('Erstelle Datei...');
        try {
            await generateAndDownloadHtml(plan, finalImageUrls);
        } catch (err) {
            console.error("Fehler beim Herunterladen:", err);
            alert("Der Plan konnte nicht heruntergeladen werden.");
        } finally {
            setIsDownloading(false);
            setDownloadStatus('Speichern');
        }
    };

    const handleShare = () => {
        if (plan && !isSharing) {
            startSharingProcess(plan);
        }
    };

    const handleLogout = async () => {
        try {
            await apiService.logout();
            window.location.reload();
        } catch (error) {
            console.error('Fehler beim Abmelden:', error);
            alert('Abmeldung fehlgeschlagen.');
        }
    };

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100">
                <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-slate-600 font-semibold mt-2">Lade Anwendung...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
    }

    const appError = planError || shareError;

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            {isGeneratingPlan && <LoadingOverlay status={generationStatus} onCancel={cancelGeneration} />}
            {isSharing && !shareUrl && <LoadingOverlay status={shareStatus} onCancel={cancelSharing} />}
            {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}
            
            <Header
                currentView={currentView}
                onSetView={handleSetView}
                planExists={!!plan}
                isSharing={isSharing}
                shareStatus={shareStatus}
                onShare={handleShare}
                isDownloading={isDownloading}
                downloadStatus={downloadStatus}
                onDownload={handleDownload}
                onLogout={handleLogout}
            />

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {currentView === 'plan' && (
                    <div className="bg-white rounded-lg shadow-lg mb-8">
                        <button
                            onClick={() => setIsSettingsVisible(!isSettingsVisible)}
                            className="w-full flex justify-between items-center p-6 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 rounded-lg"
                            aria-expanded={isSettingsVisible}
                            aria-controls="settings-panel"
                        >
                            <h2 className="text-2xl font-bold text-slate-700">Neuen Ernährungsplan erstellen</h2>
                            {isSettingsVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                        <div
                            id="settings-panel"
                            className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isSettingsVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                        >
                            <div className="overflow-hidden">
                                <div className="p-6 pt-0">
                                    <SettingsPanel 
                                        settings={panelSettings}
                                        onSettingsChange={setPanelSettings}
                                        onGeneratePlan={handleGenerateRequest} 
                                        isLoading={isGeneratingPlan} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {appError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Fehler!</strong>
                        <span className="block sm:inline ml-2">{appError}</span>
                    </div>
                )}
                
                <MainContent
                    view={currentView}
                    plan={plan}
                    archive={archive}
                    imageUrls={imageUrls}
                    loadingImages={loadingImages}
                    imageErrors={imageErrors}
                    onSelectRecipe={handleSelectRecipe}
                    onLoadPlan={handleLoadPlan}
                    onDeletePlan={deletePlanFromArchive}
                    onGenerateImage={generateImage}
                    onGenerateMissingImages={generateMissingImages}
                />
            </main>
        </div>
    );
};

export default App;