import React from 'react';
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
            : 'text-slate-600 hover:bg-slate-200'
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
    return (
        <header className="bg-white shadow-md sticky top-0 z-30">
            <div className="container mx-auto px-2 sm:px-4 py-2 flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 shrink-0">
                    KI Ernährungsplaner
                </h1>
                <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-2 grow">
                    <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <NavButton view="plan" label="Wochenplan" currentView={currentView} onClick={onSetView} />
                        <NavButton view="shopping" label="Einkauf" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                        <NavButton view="recipes" label="Rezepte" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                        <NavButton view="archive" label="Archiv" currentView={currentView} onClick={onSetView} />
                        <NavButton view="recipe-archive" label="Bibliothek" currentView={currentView} onClick={onSetView} />
                        <NavButton view="planner" label="Planer" currentView={currentView} onClick={onSetView} />
                    </nav>
                    <div className="hidden sm:block h-6 border-l border-slate-300 mx-1"></div>
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
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-md transition-colors"
                        title="Aktuellen Plan als öffentlichen Link teilen"
                    >
                        <ShareIcon />
                        <span className="hidden md:inline">{isSharing ? 'Teile...' : 'Teilen'}</span>
                    </button>
                     <button
                        onClick={onLogout}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
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