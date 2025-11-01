
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
import { generateAndDownloadHtml } from './services/htmlExporter';
import * as apiService from './services/apiService';

const defaultSettings: PlanSettings = {
    persons: 2,
    kcal: 2000,
    dietaryPreference: 'omnivore',
    dietType: 'balanced',
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
    const [isSharing, setIsSharing] = useState(false);
    const [shareStatus, setShareStatus] = useState('Teilen');
    const [shareUrl, setShareUrl] = useState<string | null>(null);

    const { archive, deletePlanFromArchive, loadPlanFromArchive, fetchArchive, updatePlanInArchive } = useArchive();
    const { plan, setPlan, isLoading, error, generateNewPlan, generationStatus } = useMealPlanGenerator();
    const { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState, setImageUrlsFromArchive } = useImageGenerator(fetchArchive);
    
    useEffect(() => {
        const checkAuth = async () => {
            try {
                await apiService.checkAuth();
                setIsAuthenticated(true);
            } catch (error) {
                console.error("Nicht authentifiziert.");
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLoadPlan = useCallback((id: string) => {
        const planToLoad = loadPlanFromArchive(id);
        if (planToLoad) {
            setPlan(planToLoad);
            setImageUrlsFromArchive(planToLoad.imageUrls || {});
            setCurrentView('plan');
            window.scrollTo(0, 0);
        }
    }, [loadPlanFromArchive, setPlan, setImageUrlsFromArchive]);

    const handleGenerateRequest = async () => {
        const result = await generateNewPlan(panelSettings);
        if (result.success) {
            if (result.newPlan) {
                setPlan(result.newPlan); 
                setImageUrlsFromArchive(result.newPlan.imageUrls || {});
                setCurrentView('plan');
                window.scrollTo(0, 0);
                fetchArchive();
            } else if (result.newPlanId) {
                console.warn("Fallback-Logik wird verwendet, um den Plan zu laden.");
                resetImageState(); 
                await fetchArchive(); 
                handleLoadPlan(result.newPlanId);
            }
        }
    };

    const handleSelectRecipe = (day: string) => {
        setSelectedRecipeDay(day);
        setCurrentView('recipes');
    };
    
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

    const handleShare = async () => {
        if (!plan || isSharing) return;
        setIsSharing(true);
    
        try {
            setShareStatus('Prüfe Link...');
            const existingLink = await apiService.checkShareLink(plan.id);
            const fullUrl = `${window.location.origin}${existingLink.shareUrl}`;
            setShareUrl(fullUrl);
            return;
    
        } catch (error) {
            if ((error as Error).message !== 'Not Found') {
                console.error("Fehler beim Prüfen des Share-Links:", error);
                alert(`Der Plan konnte nicht geteilt werden: ${(error as Error).message}`);
                setIsSharing(false);
                setShareStatus('Teilen');
                return;
            }
            
            // Link nicht gefunden, also neuen erstellen
            try {
                setShareStatus('Prüfe Bilder...');
                const finalImageUrls = await generateMissingImages(plan.recipes, plan.id, setShareStatus);
                
                setShareStatus('Link erstellen...');
                const data = await apiService.createShareLink(plan, finalImageUrls);
                const fullUrl = `${window.location.origin}${data.shareUrl}`;
                setShareUrl(fullUrl);
    
                if (plan.shareId !== data.shareId) {
                    const updatedPlan = { ...plan, shareId: data.shareId };
                    setPlan(updatedPlan);
                    updatePlanInArchive(updatedPlan);
                }
            } catch (creationError) {
                 console.error("Fehler beim Teilen:", creationError);
                 alert(`Der Plan konnte nicht geteilt werden: ${(creationError as Error).message}`);
            }
        } finally {
            setIsSharing(false);
            setShareStatus('Teilen');
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
        return <LoginComponent onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            {isLoading && <LoadingOverlay status={generationStatus} />}
            {shareUrl && <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />}
            
            <Header
                currentView={currentView}
                onSetView={setCurrentView}
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
                                        isLoading={isLoading} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Fehler!</strong>
                        <span className="block sm:inline ml-2">{error}</span>
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
