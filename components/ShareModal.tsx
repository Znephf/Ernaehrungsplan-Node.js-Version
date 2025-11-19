import React, { useState } from 'react';
import { CloseIcon, CopyIcon, WhatsAppIcon, TelegramIcon, EmailIcon, ExternalLinkIcon } from './IconComponents';

interface ShareModalProps {
  url: string;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ url, onClose }) => {
    const [copySuccess, setCopySuccess] = useState('');

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopySuccess('Link kopiert!');
            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('Kopieren fehlgeschlagen.');
            setTimeout(() => setCopySuccess(''), 2000);
        }
    };

    const encodedUrl = encodeURIComponent(url);
    const shareText = encodeURIComponent("Schau dir diesen Ernährungsplan an:");

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
        >
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full relative border border-slate-100 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-2 right-2 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Schließen"
                >
                    <CloseIcon />
                </button>
                <h2 id="share-modal-title" className="text-xl font-bold text-slate-800 dark:text-white mb-2">Planansicht</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">Jeder mit diesem Link kann den Ernährungsplan ansehen.</p>
                
                <div className="flex flex-col gap-3 bg-slate-100 dark:bg-slate-700 p-3 rounded-md border border-slate-200 dark:border-slate-600">
                    <input 
                        type="text" 
                        value={url} 
                        readOnly 
                        className="bg-transparent text-slate-700 dark:text-slate-300 text-sm focus:outline-none w-full mb-1 truncate"
                        aria-label="Teilbarer Link"
                    />
                    <div className="flex gap-2">
                         <button 
                            onClick={copyToClipboard} 
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-md transition-colors"
                        >
                            <CopyIcon />
                            <span>{copySuccess || 'Link kopieren'}</span>
                        </button>
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
                        >
                            <ExternalLinkIcon />
                            <span>Öffnen</span>
                        </a>
                    </div>
                </div>

                <div className="mt-6">
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-3">Direkt teilen über:</p>
                    <div className="flex justify-center flex-wrap gap-4">
                        <a href={`https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Auf WhatsApp teilen">
                            <WhatsAppIcon />
                        </a>
                        <a href={`https://t.me/share/url?url=${encodedUrl}&text=${shareText}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Auf Telegram teilen">
                            <TelegramIcon />
                        </a>
                        <a href={`mailto:?subject=KI%20Ern%C3%A4hrungsplan&body=${shareText}%0A${encodedUrl}`} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Per E-Mail teilen">
                            <EmailIcon />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ShareModal;