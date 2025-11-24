import React, { useState, useEffect } from 'react';
import { LoadingSpinnerIcon } from './IconComponents';

interface LoadingOverlayProps {
  status: string;
  onCancel: () => void;
}

const statusMessages: { [key: string]: { title: string; subtitle: string } } = {
  pending: {
    title: "Ihre Anfrage wird gestartet...",
    subtitle: "Bitte einen Moment Geduld."
  },
  generating_plan: {
    title: "Schritt 1/2: Wochenplan & Rezepte werden erstellt...",
    subtitle: "Die KI denkt nach. Dies kann einige Minuten dauern."
  },
  generating_shopping_list: {
    title: "Schritt 2/2: Einkaufsliste wird zusammengestellt...",
    subtitle: "Fast geschafft! Die passenden Zutaten werden berechnet."
  },
  default: {
    title: "Ihr Ernährungsplan wird erstellt!",
    subtitle: "Dies kann bis zu 5 Minuten dauern."
  }
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status, onCancel }) => {
  const [showCancelButton, setShowCancelButton] = useState(false);

  // Mache das Overlay flexibler: Wenn der Status kein bekannter Key ist,
  // behandle ihn als dynamischen Titel.
  const message = statusMessages[status] 
    ? statusMessages[status] 
    : { title: status, subtitle: 'Dies kann einen Moment dauern. Bitte laden Sie die Seite nicht neu.' };


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCancelButton(true);
    }, 5000); // Zeige den Button nach 5 Sekunden

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 text-white text-center p-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="loading-heading"
    >
      <LoadingSpinnerIcon className="animate-spin h-12 w-12 text-white mb-4" />
      <h2 id="loading-heading" className="text-xl font-bold mb-2">{message.title}</h2>
      <p className="text-slate-300 mb-6">{message.subtitle}</p>

      {showCancelButton && (
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-opacity opacity-0 animate-fade-in"
          style={{ animationFillMode: 'forwards', animationDelay: '0.5s' }}
        >
          Abbrechen
        </button>
      )}

      <style>{`
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation-name: fadeIn;
          animation-duration: 0.5s;
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;