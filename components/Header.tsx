import React, { useEffect, useState } from 'react';
import type { View } from '../types';
import { LogoutIcon, ShareIcon, PlusIcon } from './IconComponents';
 
interface HeaderProps {
    currentView: View;
    onSetView: (view: View) => void;
    planExists: boolean;
    isSharing: boolean;
    shareStatus: string;
    onShare: () => void;
    onLogout: () => void;
    onShowPlanner: () => void;
}

const NavButton: React.FC<{ view: View; label: string; currentView: View; onClick: (view: View) => void; disabled?: boolean }> = ({ view, label, currentView, onClick, disabled = false }) => (
    <button
        onClick={() => !disabled && onClick(view)}
        disabled={disabled}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            currentView === view
            ? 'bg-emerald-600 text-white shadow'
            : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {label}
    </button>
);

const Header: React.FC<HeaderProps> = ({
    currentView,
    onSetView,
    planExists,
    isSharing,
    shareStatus,
    onShare,
    onLogout,
    onShowPlanner
}) => {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        if (darkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setDarkMode(true);
        }
    };

    return (
        <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-30 transition-colors duration-300">
            <div className="container mx-auto px-2 sm:px-4 py-2 relative flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
                {/* Item 1: Title */}
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 dark:text-white shrink-0">
                    KI Ernährungsplaner
                </h1>

                {/* Item 2: Nav - will wrap on mobile, be centered on desktop */}
                <nav className="w-full lg:w-auto order-last lg:order-none lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 flex items-center justify-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <NavButton view="plan" label="Wochenplan" currentView={currentView} onClick={onSetView} />
                    <NavButton view="shopping" label="Einkauf" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                    <NavButton view="recipes" label="Rezepte" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                    <NavButton view="archive" label="Pläne" currentView={currentView} onClick={onSetView} />
                    <NavButton view="recipe-archive" label="Bibliothek" currentView={currentView} onClick={onSetView} />
                    <NavButton view="planner" label="Planer" currentView={currentView} onClick={onSetView} />
                </nav>

                {/* Item 3: Actions */}
                <div className="flex items-center gap-1 sm:gap-2">
                     <button 
                        onClick={toggleDarkMode} 
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                        title={darkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
                     >
                         {darkMode ? (
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                             </svg>
                         ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                             </svg>
                         )}
                     </button>
                     <button
                        onClick={onShowPlanner}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
                        title="Einen neuen Plan erstellen"
                    >
                        <PlusIcon />
                        <span className="hidden md:inline">Neuer Plan</span>
                    </button>
                     <button
                        onClick={onShare}
                        disabled={isSharing || !planExists}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:text-slate-400 disabled:dark:text-slate-600 disabled:cursor-not-allowed rounded-md transition-colors"
                        title="Aktuellen Plan als öffentlichen Link teilen"
                    >
                        <ShareIcon />
                        <span className="hidden md:inline">{isSharing ? 'Teile...' : 'Teilen'}</span>
                    </button>
                     <button
                        onClick={onLogout}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-200 rounded-md transition-colors"
                        title="Abmelden"
                    >
                        <LogoutIcon />
                        <span className="hidden md:inline">Abmelden</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;