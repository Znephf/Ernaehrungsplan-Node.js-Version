import React from 'react';
import type { View } from '../types';
import { DownloadIcon, LogoutIcon, ShareIcon } from './IconComponents';
 
interface HeaderProps {
    currentView: View;
    onSetView: (view: View) => void;
    planExists: boolean;
    isSharing: boolean;
    shareStatus: string;
    onShare: () => void;
    isDownloading: boolean;
    downloadStatus: string;
    onDownload: () => void;
    onLogout: () => void;
}

const NavButton: React.FC<{ view: View; label: string; currentView: View; onClick: (view: View) => void; disabled?: boolean }> = ({ view, label, currentView, onClick, disabled = false }) => (
    <button
        onClick={() => !disabled && onClick(view)}
        disabled={disabled}
        className={`px-4 py-2 text-sm sm:text-base font-medium rounded-md transition-colors ${
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
    isDownloading,
    downloadStatus,
    onDownload,
    onLogout
}) => {
    return (
        <header className="bg-white shadow-md sticky top-0 z-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">
                    KI Ernährungsplaner
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 p-1 bg-slate-100 rounded-lg">
                        <NavButton view="plan" label="Wochenplan" currentView={currentView} onClick={onSetView} />
                        <NavButton view="shopping" label="Einkaufsliste" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                        <NavButton view="recipes" label="Rezepte" currentView={currentView} onClick={onSetView} disabled={!planExists} />
                        <NavButton view="archive" label="Archiv" currentView={currentView} onClick={onSetView} />
                    </nav>
                    <div className="hidden sm:block h-8 border-l border-slate-300 mx-2"></div>
                     <button
                        onClick={onShare}
                        disabled={isSharing || !planExists}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-md transition-colors w-28 text-center"
                        title="Aktuellen Plan als öffentlichen Link teilen"
                    >
                        <ShareIcon />
                        <span className="hidden sm:inline">{isSharing ? 'Teile...' : 'Teilen'}</span>
                    </button>
                     <button
                        onClick={onDownload}
                        disabled={isDownloading || !planExists}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-md transition-colors w-28 text-center"
                        title="Aktuellen Plan als interaktive HTML-Datei speichern"
                    >
                        <DownloadIcon />
                        <span className="hidden sm:inline">{isDownloading ? 'Speichere...' : 'Speichern'}</span>
                    </button>
                     <button
                        onClick={onLogout}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
                        title="Abmelden"
                    >
                        <LogoutIcon />
                        <span className="hidden sm:inline">Abmelden</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;