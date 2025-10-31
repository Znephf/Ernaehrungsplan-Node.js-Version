import React from 'react';

interface LoadingOverlayProps {
  status: string;
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


const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ status }) => {
  const message = statusMessages[status] || statusMessages.default;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 text-white text-center p-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="loading-heading"
    >
      <svg className="animate-spin h-12 w-12 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <h2 id="loading-heading" className="text-xl font-bold mb-2">{message.title}</h2>
      <p className="text-slate-300">{message.subtitle}</p>
    </div>
  );
};

export default LoadingOverlay;