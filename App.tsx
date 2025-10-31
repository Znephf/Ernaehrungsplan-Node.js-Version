import React, { useState, useCallback, useEffect } from 'react';
import ShoppingListComponent from './components/ShoppingList';
import WeeklyPlanComponent from './components/WeeklyPlan';
import RecipesComponent from './components/Recipes';
import ArchiveComponent from './components/Archive';
import SettingsPanel from './components/SettingsPanel';
import LoginComponent from './components/Login';
import type { View, PlanSettings, PlanData } from './types';
import { useArchive } from './hooks/useArchive';
import { useMealPlanGenerator } from './hooks/useMealPlanGenerator';
import { useImageGenerator } from './hooks/useImageGenerator';
import { ChevronUpIcon, ChevronDownIcon, DownloadIcon, LogoutIcon } from './components/IconComponents';
import { generateAndDownloadHtml } from './services/htmlExporter';


const defaultSettings: PlanSettings = {
    persons: 2,
    kcal: 1500,
    dietaryPreference: 'vegetarian',
    dietType: 'low-carb',
    excludedIngredients: '',
    desiredIngredients: '',
    breakfastOption: 'quark',
    customBreakfast: ''
};

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [currentView, setCurrentView] = useState<View>('plan');
    const [selectedRecipeDay, setSelectedRecipeDay] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(true);
    const [panelSettings, setPanelSettings] = useState<PlanSettings>(defaultSettings);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('Speichern');
    const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);


    const { archive, deletePlanFromArchive, loadPlanFromArchive, fetchArchive } = useArchive();
    const { plan, setPlan, isLoading, error, generateNewPlan } = useMealPlanGenerator();
    const { imageUrls, loadingImages, imageErrors, generateImage, generateMissingImages, resetImageState, setImageUrlsFromArchive } = useImageGenerator();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/check-auth');
                if (response.ok) {
                    const data = await response.json();
                    setIsAuthenticated(data.isAuthenticated);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (err) {
                console.error("Auth check failed", err);
                setIsAuthenticated(false);
            }
        };
        checkAuth();
    }, []);

    const handleGenerateRequest = async () => {
        const result = await generateNewPlan(panelSettings);
        if (result.success && result.newPlanId) {
            setCurrentPlanId(result.newPlanId);
            // Ein neuer Plan hat per Definition keine Bilder, also wird der Image-State zurückgesetzt
            resetImageState();
            // Lade das Archiv neu, um den gerade erstellten Plan anzuzeigen
            fetchArchive();
        }
    };

    const handleSelectRecipe = (day: string) => {
        setSelectedRecipeDay(day);
        setCurrentView('recipes');
    };

    const handleLoadPlan = useCallback((id: string) => {
        const planToLoad = loadPlanFromArchive(id);
        if (planToLoad) {
            setPlan(planToLoad);
            setCurrentPlanId(id);
            setImageUrlsFromArchive(planToLoad.imageUrls || {});
            setCurrentView('plan');
        }
    }, [loadPlanFromArchive, setPlan, setImageUrlsFromArchive]);
    
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
        
        const finalImageUrls = await generateMissingImages(plan.recipes, setDownloadStatus);
        
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

    const handleLogout = async () => {
        try {
            await fetch('/logout', { method: 'POST' });
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Fehler beim Abmelden:', error);
            alert('Abmeldung fehlgeschlagen.');
        }
    };

    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100">
                <div className="text-xl font-semibold text-slate-600">Lade...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginComponent onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    const renderView = () => {
        switch (currentView) {
            case 'shopping':
                return <ShoppingListComponent shoppingList={plan.shoppingList} />;
            case 'plan':
                return <WeeklyPlanComponent weeklyPlan={plan.weeklyPlan} planName={plan.name} onSelectRecipe={handleSelectRecipe} />;
            case 'recipes':
                return <RecipesComponent 
                            recipes={plan.recipes} 
                            planId={currentPlanId}
                            imageUrls={imageUrls}
                            loadingImages={loadingImages}
                            imageErrors={imageErrors}
                            generateImage={generateImage}
                            generateMissingImages={generateMissingImages}
                        />;
            case 'archive':
                return <ArchiveComponent archive={archive} onLoadPlan={handleLoadPlan} onDeletePlan={deletePlanFromArchive} />;
            default:
                return null;
        }
    };

    const NavButton: React.FC<{ view: View; label: string }> = ({ view, label }) => (
        <button
            onClick={() => setCurrentView(view)}
            className={`px-4 py-2 text-sm sm:text-base font-medium rounded-md transition-colors ${
                currentView === view
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            <header className="bg-white shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">
                        KI Ernährungsplaner
                    </h1>
                    <div className="flex items-center gap-2">
                        <nav className="flex items-center justify-center gap-2 sm:gap-4 p-1 bg-slate-100 rounded-lg">
                            <NavButton view="plan" label="Wochenplan" />
                            <NavButton view="shopping" label="Einkaufsliste" />
                            <NavButton view="recipes" label="Rezepte" />
                            <NavButton view="archive" label="Archiv" />
                        </nav>
                        <div className="h-8 border-l border-slate-300 mx-2"></div>
                         <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-md transition-colors w-40 text-center"
                            title="Aktuellen Plan als interaktive HTML-Datei speichern"
                        >
                            <DownloadIcon />
                            <span className="hidden sm:inline">{isDownloading ? downloadStatus : 'Speichern'}</span>
                        </button>
                         <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
                            title="Abmelden"
                        >
                            <LogoutIcon />
                            <span className="hidden sm:inline">Abmelden</span>
                        </button>
                    </div>
                </div>
            </header>

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
                            className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${
                                isSettingsVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                            }`}
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
                
                {plan && renderView()}
            </main>
        </div>
    );
};

export default App;